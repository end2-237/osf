-- ════════════════════════════════════════════════════════════════════════════
--  LES NOTIFICATIONS DU RELAIS
--
--  Sans elles, rien ne marche. Le mécanisme repose sur une réponse en trente
--  secondes : si l'appel n'arrive pas sur le téléphone du commerçant, il n'y
--  a pas de réponse, pas de couverture, pas de relais.
--
--  Et l'envoyeur doit apprendre que sa vente s'est faite, à la minute où elle
--  se fait, avec le montant de son bon. C'est la boucle de renforcement : ce
--  qui le fait recommencer demain. Un commerçant qui envoie un client et
--  n'entend plus jamais parler de rien ne recommencera pas.
--
--  QUATRE MOMENTS, ET PAS UN DE PLUS
--
--    appel     → aux boutiques interrogées. « Quelqu'un cherche ça. Tu l'as ? »
--    arrive    → à la boutique qui reçoit. Elle sait qu'on lui envoie quelqu'un.
--    vendu     → à celle qui a envoyé. « + 2 400 F. » C'est la seule qui compte.
--    pas_venu  → à celle qui a envoyé, sans reproche : elle a fait son travail,
--                c'est le client qui a changé d'avis.
--
--  On ne notifie pas la rupture ni l'annulation : le commerçant n'a rien à
--  faire de ces informations sur le moment, et une notification qu'on ne peut
--  pas traiter apprend à ignorer les suivantes.
--
--  Les écritures se font par déclencheur, jamais depuis le navigateur : une
--  notification qui dépend d'un client connecté est une notification qui
--  n'arrive pas.
--
--  Idempotent : rejouable sans dommage, dans n'importe quel ordre.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DO $trg$
BEGIN
  -- Un déclencheur dépend de sa fonction : PostgreSQL refuse de supprimer la
  -- seconde tant que le premier existe. On les retire donc d'abord, et ce
  -- fichier les recrée plus bas.
  DROP TRIGGER IF EXISTS trg_notifier_appel     ON public.appels;
  DROP TRIGGER IF EXISTS trg_notifier_relais_ins ON public.relais;
  DROP TRIGGER IF EXISTS trg_notifier_relais_upd ON public.relais;
EXCEPTION WHEN undefined_table THEN NULL;
END
$trg$;

DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('notifier_appel', 'notifier_relais', 'notifications_a_envoyer',
                         'marquer_notifications_envoyees', 'mes_notifications')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LA FILE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.relais_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  genre       TEXT NOT NULL CHECK (genre IN ('appel', 'arrive', 'vendu', 'pas_venu')),
  titre       TEXT NOT NULL,
  corps       TEXT NOT NULL,
  lien        TEXT,
  appel_id    UUID REFERENCES public.appels(id) ON DELETE CASCADE,
  relais_id   UUID REFERENCES public.relais(id) ON DELETE CASCADE,
  envoyee_le  TIMESTAMPTZ,
  lue_le      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une seule notification par boutique et par événement, quoi qu'il arrive.
CREATE UNIQUE INDEX IF NOT EXISTS relais_notif_appel_uq
  ON public.relais_notifications (vendor_id, appel_id) WHERE appel_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS relais_notif_relais_uq
  ON public.relais_notifications (vendor_id, relais_id, genre) WHERE relais_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS relais_notif_file_idx
  ON public.relais_notifications (created_at) WHERE envoyee_le IS NULL;
CREATE INDEX IF NOT EXISTS relais_notif_vendor_idx
  ON public.relais_notifications (vendor_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
--  2. L'APPEL — à toutes les boutiques susceptibles d'avoir l'article
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notifier_appel()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rayon UUID; v_emetteur UUID; v_libelle TEXT; v_titre TEXT; v_corps TEXT;
BEGIN
  SELECT d.rayon_id, d.vendor_id, d.libelle
    INTO v_rayon, v_emetteur, v_libelle
    FROM public.demandes d WHERE d.id = NEW.demande_id;

  -- Sur un appel fermé, la boutique reconnaît l'article : deux boutons, deux
  -- secondes. Sur un appel ouvert, elle doit chercher — c'est plus long, et
  -- c'est pour ça que le catalogue compte.
  v_titre := CASE WHEN NEW.forme = 'ferme' THEN 'Tu as encore ça ?' ELSE 'Quelqu''un cherche' END;
  v_corps := v_libelle || ' — réponds en 30 secondes';

  INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien, appel_id)
  SELECT br.vendor_id, 'appel', v_titre, v_corps, '/admin?section=relais', NEW.id
    FROM public.boutique_rayon br
   WHERE br.rayon_id = v_rayon
     AND br.actif
     AND br.genre = 'produit'
     AND br.vendor_id <> v_emetteur
     AND (
       -- Appel fermé : ceux qui ont référencé cet article précis.
       (NEW.forme = 'ferme' AND EXISTS (
          SELECT 1 FROM public.products p
           WHERE p.id = NEW.product_id AND p.vendor_id = br.vendor_id))
       -- Appel ouvert : les porteurs de la famille.
       OR (NEW.forme = 'ouvert' AND EXISTS (
          SELECT 1 FROM public.boutique_famille bf
            JOIN public.demandes d ON d.id = NEW.demande_id
           WHERE bf.vendor_id = br.vendor_id AND bf.famille_id = d.famille_id))
     )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_notifier_appel ON public.appels;
CREATE TRIGGER trg_notifier_appel
  AFTER INSERT ON public.appels
  FOR EACH ROW EXECUTE FUNCTION public.notifier_appel();

-- ════════════════════════════════════════════════════════════════════════════
--  3. LE RELAIS — arrivée, vente, et client qui n'est jamais venu
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notifier_relais()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emetteur TEXT; v_receveur TEXT; v_fcfa TEXT;
BEGIN
  SELECT shop_name INTO v_emetteur FROM public.vendors WHERE id = NEW.emetteur_id;
  SELECT shop_name INTO v_receveur FROM public.vendors WHERE id = NEW.receveur_id;

  -- Un client vient d'être envoyé chez elle. Elle a trente à quarante minutes
  -- pour être prête ; le plus souvent il arrive dans les cinq.
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien, relais_id)
    VALUES (NEW.receveur_id, 'arrive',
            'Un client arrive',
            NEW.libelle || ' — envoyé par ' || COALESCE(v_emetteur, 'une boutique du rayon'),
            '/admin?section=relais', NEW.id)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF NEW.etat = OLD.etat THEN RETURN NEW; END IF;

  -- La seule notification qui compte vraiment. Elle arrive à la minute où
  -- l'argent devient réel, et c'est elle qui le fera recommencer demain.
  IF NEW.etat = 'remis' THEN
    v_fcfa := to_char(NEW.bon, 'FM999G999') || ' F';
    INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien, relais_id)
    VALUES (NEW.emetteur_id, 'vendu',
            '+ ' || v_fcfa || ' pour toi',
            'Ton client a acheté chez ' || COALESCE(v_receveur, 'la boutique') ||
            '. Tu n''as rien vendu, et tu as gagné ' || v_fcfa || '.',
            '/admin?section=relais', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sans reproche, et c'est délibéré : il a fait son travail. Lui écrire
  -- « ton client n'y est pas allé » sur un ton de constat, pas de bilan.
  IF NEW.etat = 'expire' THEN
    INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien, relais_id)
    VALUES (NEW.emetteur_id, 'pas_venu',
            'Ton client n''y est pas allé',
            NEW.libelle || ' — le bon a expiré. Ça arrive une fois sur dix, et tu n''as rien perdu.',
            '/admin?section=relais', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_notifier_relais_ins ON public.relais;
CREATE TRIGGER trg_notifier_relais_ins
  AFTER INSERT ON public.relais
  FOR EACH ROW EXECUTE FUNCTION public.notifier_relais();

DROP TRIGGER IF EXISTS trg_notifier_relais_upd ON public.relais;
CREATE TRIGGER trg_notifier_relais_upd
  AFTER UPDATE OF etat ON public.relais
  FOR EACH ROW EXECUTE FUNCTION public.notifier_relais();

-- ════════════════════════════════════════════════════════════════════════════
--  4. LA VIDANGE — pour la fonction edge qui pousse vers Firebase
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notifications_a_envoyer(p_limite INTEGER DEFAULT 100)
RETURNS TABLE (id UUID, vendor_id UUID, genre TEXT, titre TEXT, corps TEXT, lien TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.vendor_id, n.genre, n.titre, n.corps, n.lien
    FROM public.relais_notifications n
   WHERE n.envoyee_le IS NULL
     -- Une notification d'appel qui a plus de deux minutes n'a plus d'objet :
     -- l'appel est clos, et la pousser ne ferait qu'apprendre à les ignorer.
     AND NOT (n.genre = 'appel' AND n.created_at < NOW() - INTERVAL '2 minutes')
   ORDER BY n.created_at
   LIMIT p_limite;
$$;

CREATE OR REPLACE FUNCTION public.marquer_notifications_envoyees(p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.relais_notifications SET envoyee_le = NOW()
   WHERE id = ANY(p_ids) AND envoyee_le IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

-- Ce que la boutique voit dans son tableau de bord, même sans notification
-- poussée — un téléphone sans Firebase doit rester utilisable.
CREATE OR REPLACE FUNCTION public.mes_notifications(p_vendor_id UUID, p_limite INTEGER DEFAULT 30)
RETURNS TABLE (id UUID, genre TEXT, titre TEXT, corps TEXT, lien TEXT,
               appel_id UUID, relais_id UUID, lue BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.genre, n.titre, n.corps, n.lien, n.appel_id, n.relais_id,
         n.lue_le IS NOT NULL, n.created_at
    FROM public.relais_notifications n
   WHERE n.vendor_id = p_vendor_id
   ORDER BY n.created_at DESC
   LIMIT p_limite;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  5. QUI VOIT QUOI
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.relais_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS relais_notif_mine ON public.relais_notifications;
CREATE POLICY relais_notif_mine ON public.relais_notifications FOR SELECT
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS relais_notif_lue ON public.relais_notifications;
CREATE POLICY relais_notif_lue ON public.relais_notifications FOR UPDATE
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

GRANT EXECUTE ON FUNCTION public.mes_notifications(UUID, INTEGER)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.notifications_a_envoyer(INTEGER)    TO service_role;
GRANT EXECUTE ON FUNCTION public.marquer_notifications_envoyees(UUID[]) TO service_role;
