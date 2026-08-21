-- ════════════════════════════════════════════════════════════════════════════
--  42 — PARLER AU VENDEUR, ET NE PLUS ACCEPTER LES DOUBLONS
--
--  Deux défauts constatés le même jour, et ils se répondent.
--
--  ① UNE BOUTIQUE AVAIT PUBLIÉ QUATRE FOIS LE MÊME ARTICLE. Le formulaire
--  verrouille pourtant le bouton pendant l'envoi. Ce n'est donc pas un double
--  clic : c'est un envoi qui ABOUTIT côté serveur pendant que la réponse se
--  perd sur le réseau. Le vendeur voit « Erreur », recommence, et la ligne est
--  écrite une deuxième fois. Quatre fois veut dire trois réseaux coupés — à
--  Douala, une après-midi ordinaire.
--
--  Un verrou dans le navigateur ne pouvait pas attraper ça, parce que le
--  navigateur ne sait pas que ça a marché. Seule la base le sait. D'où l'index
--  unique : c'est aussi une règle de commerce saine — une boutique n'a pas
--  deux annonces identiques, les déclinaisons vivent DANS la fiche.
--
--  ② LA SUPPRESSION ADMINISTRATIVE ÉTAIT MUETTE. Le vendeur quittait son
--  comptoir avec 44 articles et le retrouvait à 41, sans un mot. C'est le
--  genre de silence qui fait perdre une boutique : il ne sait pas ce qu'il a
--  fait de mal, donc il le refera, et il finit par croire que la plateforme
--  perd ses données.
--
--  À partir d'ici, toute action de l'administration sur une boutique laisse
--  DEUX traces : un message au vendeur, et une ligne d'historique qu'il peut
--  relire. Et l'administration peut aussi écrire sans agir — un rappel, une
--  relance, une consigne.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── ① Plus de doublons ─────────────────────────────────────────────────────

-- On ne crée pas l'index à l'aveugle : s'il reste des doublons, la création
-- échouerait et emporterait toute la migration. On regarde d'abord, on dit ce
-- qu'on trouve, et on pose l'index seulement quand la voie est libre.
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT vendor_id, lower(btrim(name))
    FROM public.products
    WHERE vendor_id IS NOT NULL
    GROUP BY 1, 2 HAVING count(*) > 1
  ) d;

  IF n = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS products_vendeur_nom_uq
      ON public.products (vendor_id, lower(btrim(name)))
      WHERE vendor_id IS NOT NULL;
    RAISE NOTICE 'Aucun doublon. Index unique posé : une boutique ne peut plus publier deux fois le même nom.';
  ELSE
    RAISE NOTICE 'ATTENTION : % groupe(s) de doublons subsistent. L''index n''est PAS posé.', n;
    RAISE NOTICE 'Nettoie-les depuis Super-admin → Produits → « Doublons », puis rejoue cette migration.';
  END IF;
END $$;

-- Ce que lit la console pour proposer le ménage. On garde le plus ancien —
-- c'est celui qui porte les vues, les avis et les commandes passées.
CREATE OR REPLACE FUNCTION public.doublons_produits()
RETURNS TABLE (
  vendor_id UUID, shop_name TEXT, nom TEXT, combien BIGINT,
  garder UUID, supprimer UUID[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH g AS (
    SELECT p.vendor_id, lower(btrim(p.name)) AS cle,
           min(p.name) AS nom, count(*) AS combien,
           (array_agg(p.id ORDER BY p.created_at))[1] AS garder,
           (array_agg(p.id ORDER BY p.created_at))[2:] AS supprimer
    FROM public.products p
    WHERE p.vendor_id IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) > 1
  )
  SELECT g.vendor_id, v.shop_name, g.nom, g.combien, g.garder, g.supprimer
  FROM g JOIN public.vendors v ON v.id = g.vendor_id
  ORDER BY g.combien DESC, v.shop_name;
$$;

-- ─── ② L'historique des actions de l'administration ─────────────────────────

CREATE TABLE IF NOT EXISTS public.actions_admin (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,

  --   'produit_retire'      un article supprimé du catalogue
  --   'produit_masque'      un article rendu invisible sans être supprimé
  --   'boutique_suspendue'  la boutique ne vend plus
  --   'boutique_retablie'
  --   'avertissement'       un rappel à l'ordre, sans effet technique
  --   'message'             une simple parole : rappel, relance, consigne
  genre       TEXT NOT NULL,

  motif       TEXT,                  -- la case cochée par l'administrateur
  message     TEXT NOT NULL,         -- ce que le vendeur lit, tel quel
  cible       TEXT,                  -- le nom de l'article, pour le relire plus tard
  cible_id    UUID,

  -- La fiche complète de l'article supprimé. C'est ce qui permet de revenir
  -- en arrière : une suppression administrative se conteste, et sans copie on
  -- ne peut que dire « c'est perdu ».
  copie       JSONB,

  par         UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actions_admin_vendor_idx
  ON public.actions_admin (vendor_id, created_at DESC);

ALTER TABLE public.actions_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS actions_admin_admin ON public.actions_admin;
CREATE POLICY actions_admin_admin ON public.actions_admin
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Le vendeur lit ce qui le concerne. C'est tout l'intérêt : qu'il puisse
-- relire, une semaine après, pourquoi son article a disparu.
DROP POLICY IF EXISTS actions_admin_vendeur ON public.actions_admin;
CREATE POLICY actions_admin_vendeur ON public.actions_admin
  FOR SELECT USING (public.owns_vendor(vendor_id));

-- ─── ③ La boîte du vendeur accueille l'administration ───────────────────────
--  On réutilise `relais_notifications` plutôt que d'ouvrir une seconde file :
--  c'est déjà la boîte du commerçant, elle est déjà lue par l'application, et
--  elle est déjà poussée vers le téléphone. Une seconde file voudrait dire un
--  second écran, un second compteur, et un message sur deux qui se perd.

ALTER TABLE public.relais_notifications DROP CONSTRAINT IF EXISTS relais_notifications_genre_check;
ALTER TABLE public.relais_notifications ADD CONSTRAINT relais_notifications_genre_check
  CHECK (genre IN (
    'appel', 'arrive', 'vendu', 'pas_venu',              -- le relais
    'produit_retire', 'produit_masque',                  -- la modération
    'boutique_suspendue', 'boutique_retablie',
    'avertissement', 'message'                           -- la parole
  ));

-- ─── ④ Ce que fait l'administration ─────────────────────────────────────────

-- Écrire au vendeur, sans rien changer d'autre. Le cas le plus fréquent, et
-- celui qui n'existait pas du tout.
CREATE OR REPLACE FUNCTION public.admin_ecrire_vendeur(
  p_vendor_id UUID,
  p_titre     TEXT,
  p_message   TEXT,
  p_genre     TEXT DEFAULT 'message',
  p_motif     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administration.';
  END IF;
  IF coalesce(btrim(p_message), '') = '' THEN
    RAISE EXCEPTION 'Un message vide ne dit rien au vendeur.';
  END IF;

  INSERT INTO public.actions_admin (vendor_id, genre, motif, message, par)
  VALUES (p_vendor_id, p_genre, p_motif, btrim(p_message), auth.uid())
  RETURNING id INTO v_action;

  INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien)
  VALUES (p_vendor_id, p_genre,
          coalesce(nullif(btrim(p_titre), ''), 'Message de Buyticle'),
          btrim(p_message), '/vendeur/messages');

  RETURN v_action;
END $$;

-- Retirer un article, en le disant. La copie est prise AVANT la suppression :
-- après, il n'y a plus rien à copier, et c'est exactement le moment où on
-- regrette de ne pas l'avoir fait.
CREATE OR REPLACE FUNCTION public.admin_retirer_produit(
  p_product_id UUID,
  p_motif      TEXT,
  p_message    TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_produit  public.products%ROWTYPE;
  v_action   UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administration.';
  END IF;

  SELECT * INTO v_produit FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cet article n''existe plus.';
  END IF;

  -- Un article de la plateforme (importé, sans boutique) n'a personne à
  -- prévenir : on le supprime et on s'arrête là.
  IF v_produit.vendor_id IS NULL THEN
    DELETE FROM public.products WHERE id = p_product_id;
    RETURN NULL;
  END IF;

  INSERT INTO public.actions_admin
    (vendor_id, genre, motif, message, cible, cible_id, copie, par)
  VALUES (v_produit.vendor_id, 'produit_retire', p_motif,
          btrim(p_message), v_produit.name, v_produit.id,
          to_jsonb(v_produit), auth.uid())
  RETURNING id INTO v_action;

  INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien)
  VALUES (v_produit.vendor_id, 'produit_retire',
          'Un article a été retiré',
          btrim(p_message), '/vendeur/messages');

  DELETE FROM public.products WHERE id = p_product_id;
  RETURN v_action;
END $$;


-- Retirer PLUSIEURS articles d'un coup, et n'écrire QU'UNE fois par boutique.
-- La version qui boucle sur `admin_retirer_produit` marchait, et envoyait au
-- vendeur trois fois le même texte pour un seul ménage. Une boîte de réception
-- qui répète devient une boîte qu'on n'ouvre plus — et c'est justement celle
-- où on veut pouvoir le joindre le jour où ça compte.
CREATE OR REPLACE FUNCTION public.admin_retirer_produits(
  p_ids     UUID[],
  p_motif   TEXT,
  p_message TEXT
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_produit public.products%ROWTYPE;
  v_vendor  UUID;
  v_noms    TEXT[];
  v_n       INT := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administration.';
  END IF;

  FOR v_vendor IN
    SELECT DISTINCT vendor_id FROM public.products
    WHERE id = ANY(p_ids) AND vendor_id IS NOT NULL
  LOOP
    v_noms := ARRAY[]::TEXT[];

    FOR v_produit IN
      SELECT * FROM public.products WHERE id = ANY(p_ids) AND vendor_id = v_vendor
    LOOP
      INSERT INTO public.actions_admin
        (vendor_id, genre, motif, message, cible, cible_id, copie, par)
      VALUES (v_vendor, 'produit_retire', p_motif, btrim(p_message),
              v_produit.name, v_produit.id, to_jsonb(v_produit), auth.uid());

      -- On ne répète pas un nom : quand le ménage porte sur des doublons,
      -- lister trois fois « Marteau de charpentier » ne dit rien de plus.
      IF NOT (v_produit.name = ANY(v_noms)) THEN
        v_noms := v_noms || v_produit.name;
      END IF;
      v_n := v_n + 1;
    END LOOP;

    DELETE FROM public.products WHERE id = ANY(p_ids) AND vendor_id = v_vendor;

    INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien)
    VALUES (v_vendor, 'produit_retire',
            CASE WHEN array_length(v_noms, 1) = 1
                 THEN 'Un article a été retiré'
                 ELSE format('%s articles ont été retirés', array_length(v_noms, 1)) END,
            btrim(p_message) || E'\n\nConcerné : ' || array_to_string(v_noms, ', ') || '.',
            '/vendeur/messages');
  END LOOP;

  -- Les articles de la plateforme n'ont personne à prévenir.
  DELETE FROM public.products WHERE id = ANY(p_ids) AND vendor_id IS NULL;

  RETURN v_n;
END $$;

-- Remettre en ligne un article retiré à tort. Sans ça, la copie ne servirait
-- qu'à constater les dégâts.
CREATE OR REPLACE FUNCTION public.admin_retablir_produit(p_action_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action public.actions_admin%ROWTYPE;
  v_id     UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administration.';
  END IF;

  SELECT * INTO v_action FROM public.actions_admin WHERE id = p_action_id;
  IF NOT FOUND OR v_action.copie IS NULL THEN
    RAISE EXCEPTION 'Aucune copie à rétablir pour cette action.';
  END IF;

  INSERT INTO public.products
  SELECT * FROM jsonb_populate_record(NULL::public.products, v_action.copie)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_id;

  INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien)
  VALUES (v_action.vendor_id, 'message', 'Ton article est revenu',
          format('« %s » a été remis en ligne. Toutes nos excuses pour le dérangement.',
                 v_action.cible),
          '/vendeur/produits');

  INSERT INTO public.actions_admin (vendor_id, genre, motif, message, cible, cible_id, par)
  VALUES (v_action.vendor_id, 'message', 'retablissement',
          format('« %s » a été remis en ligne.', v_action.cible),
          v_action.cible, v_action.cible_id, auth.uid());

  RETURN v_id;
END $$;

-- Suspendre ou rétablir une boutique, en le disant aussi.
CREATE OR REPLACE FUNCTION public.admin_basculer_boutique(
  p_vendor_id UUID,
  p_active    BOOLEAN,
  p_motif     TEXT,
  p_message   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action UUID; v_genre TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Réservé à l''administration.';
  END IF;

  v_genre := CASE WHEN p_active THEN 'boutique_retablie' ELSE 'boutique_suspendue' END;

  UPDATE public.vendors SET is_active = p_active WHERE id = p_vendor_id;

  INSERT INTO public.actions_admin (vendor_id, genre, motif, message, par)
  VALUES (p_vendor_id, v_genre, p_motif, btrim(p_message), auth.uid())
  RETURNING id INTO v_action;

  INSERT INTO public.relais_notifications (vendor_id, genre, titre, corps, lien)
  VALUES (p_vendor_id, v_genre,
          CASE WHEN p_active THEN 'Ta boutique est de nouveau ouverte'
               ELSE 'Ta boutique a été suspendue' END,
          btrim(p_message), '/vendeur/messages');

  RETURN v_action;
END $$;

-- L'historique, tel que le vendeur le relira. C'est la fonction qui répare le
-- « je suis parti avec 44 articles et j'en retrouve 41 ».
CREATE OR REPLACE FUNCTION public.mes_actions_admin(p_vendor_id UUID, p_limite INT DEFAULT 50)
RETURNS TABLE (id UUID, genre TEXT, motif TEXT, message TEXT,
               cible TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.genre, a.motif, a.message, a.cible, a.created_at
  FROM public.actions_admin a
  WHERE a.vendor_id = p_vendor_id
    AND (public.owns_vendor(p_vendor_id) OR public.is_super_admin())
  ORDER BY a.created_at DESC
  LIMIT p_limite;
$$;

GRANT EXECUTE ON FUNCTION public.doublons_produits()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ecrire_vendeur(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retirer_produit(UUID, TEXT, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retirer_produits(UUID[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retablir_produit(UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_basculer_boutique(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mes_actions_admin(UUID, INT)             TO authenticated;

-- ─── ⑤ Vérification ─────────────────────────────────────────────────────────
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.doublons_produits();
  IF n > 0 THEN
    RAISE NOTICE 'À nettoyer : % article(s) publié(s) en double.', n;
  END IF;
  RAISE NOTICE 'L''administration peut désormais parler aux boutiques.';
END $$;
