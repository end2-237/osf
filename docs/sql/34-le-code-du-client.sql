-- ════════════════════════════════════════════════════════════════════════════
--  COMMENT UN CLIENT OBTIENT SON CODE
--
--  Le maillon qui manquait, et sans lui rien n'aboutit : le relais était créé
--  avec client_id à NULL, donc `mon_relais()` ne trouvait jamais rien et le
--  client voyait « aucun relais en cours » pour un relais qui existait.
--
--  LE PROBLÈME RÉEL. Le vendeur doit attacher un client précis à un relais, et
--  ce client est debout devant lui — pas identifié par un compte qu'il aurait
--  saisi, pas retrouvable par un numéro qu'il faudrait taper à deux. Il faut
--  que l'un des deux montre quelque chose à l'autre, en deux secondes, dans une
--  allée bruyante.
--
--  LA PRÉSENCE AU COMPTOIR. Quand le client scanne l'affiche collée sur le
--  comptoir, on enregistre qu'il est LÀ, MAINTENANT, chez CE commerçant. Ça lui
--  donne un code personnel de quatre caractères, affiché en grand sur son
--  téléphone. Le vendeur, lui, voit apparaître la liste des gens qui viennent
--  de scanner son comptoir : il tape sur le bon, ou il saisit le code si deux
--  personnes ont scanné en même temps.
--
--  Quinze minutes de validité. Au-delà, le client n'est plus devant le
--  comptoir — et attacher un relais à quelqu'un qui est parti serait pire que
--  de ne rien attacher du tout.
--
--  DEUX CODES DIFFÉRENTS, ET IL NE FAUT PAS LES CONFONDRE :
--    · le code de PRÉSENCE, 4 caractères, sert à dire « c'est moi » au vendeur
--      qui envoie. Il vit quinze minutes.
--    · le code de RELAIS, 6 caractères, sert à dire « c'est bien moi » au
--      comptoir de la boutique qui reçoit. Il vit 48 heures.
--
--  Idempotent : rejouable sans dommage, dans n'importe quel ordre.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('signaler_presence', 'presences_du_comptoir',
                         'ma_presence', 'attribuer_relais', 'code_presence')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LA PRÉSENCE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.presences_comptoir (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  code       TEXT NOT NULL,
  expire_le  TIMESTAMPTZ NOT NULL,
  utilisee   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presences_comptoir_actives_idx
  ON public.presences_comptoir (vendor_id, created_at DESC)
  WHERE NOT utilisee;
CREATE INDEX IF NOT EXISTS presences_comptoir_user_idx
  ON public.presences_comptoir (user_id, created_at DESC);

-- Quatre caractères, sans 0/O/1/I : il se lit à voix haute et se tape sans
-- erreur. Court exprès — le client le montre, il ne le retient pas.
CREATE OR REPLACE FUNCTION public.code_presence()
RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE alpha TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c TEXT; i INTEGER;
BEGIN
  LOOP
    c := '';
    FOR i IN 1..4 LOOP
      c := c || substr(alpha, 1 + floor(random() * length(alpha))::INTEGER, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.presences_comptoir
       WHERE code = c AND NOT utilisee AND expire_le > NOW());
  END LOOP;
  RETURN c;
END
$$;

-- Le client vient de scanner l'affiche du comptoir. On note qu'il est là.
CREATE OR REPLACE FUNCTION public.signaler_presence(p_referral_code TEXT)
RETURNS TABLE (code TEXT, boutique TEXT, expire_le TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vendor UUID; v_nom TEXT; v_code TEXT; v_exp TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connecte-toi d''abord'; END IF;

  SELECT v.id, v.shop_name INTO v_vendor, v_nom
    FROM public.vendors v
   WHERE upper(v.referral_code) = upper(trim(p_referral_code));
  IF v_vendor IS NULL THEN RAISE EXCEPTION 'Boutique inconnue'; END IF;

  -- Une présence à la fois par personne et par comptoir : rescanner rafraîchit
  -- la même, sinon le vendeur verrait la même personne trois fois dans sa liste.
  UPDATE public.presences_comptoir
     SET utilisee = TRUE
   WHERE user_id = auth.uid() AND NOT utilisee;

  v_code := public.code_presence();
  v_exp  := NOW() + INTERVAL '15 minutes';

  INSERT INTO public.presences_comptoir (vendor_id, user_id, code, expire_le)
  VALUES (v_vendor, auth.uid(), v_code, v_exp);

  RETURN QUERY SELECT v_code, v_nom, v_exp;
END
$$;

-- Ce que le client voit tant qu'aucun relais ne lui a été attribué.
CREATE OR REPLACE FUNCTION public.ma_presence()
RETURNS TABLE (code TEXT, boutique TEXT, expire_le TIMESTAMPTZ, reste_s INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code, v.shop_name, p.expire_le,
         GREATEST(0, CEIL(EXTRACT(EPOCH FROM (p.expire_le - NOW()))))::INTEGER
    FROM public.presences_comptoir p
    JOIN public.vendors v ON v.id = p.vendor_id
   WHERE p.user_id = auth.uid()
     AND NOT p.utilisee
     AND p.expire_le > NOW()
   ORDER BY p.created_at DESC
   LIMIT 1;
$$;

-- Ce que le vendeur voit : qui vient de scanner son comptoir. Le plus récent
-- en premier — c'est presque toujours celui qui est devant lui.
CREATE OR REPLACE FUNCTION public.presences_du_comptoir(p_vendor_id UUID)
RETURNS TABLE (code TEXT, nom TEXT, telephone TEXT, il_y_a_s INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code,
         COALESCE(NULLIF(pr.full_name, ''), 'Client'),
         COALESCE(pr.phone, u.raw_user_meta_data->>'phone'),
         CEIL(EXTRACT(EPOCH FROM (NOW() - p.created_at)))::INTEGER
    FROM public.presences_comptoir p
    JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
   WHERE p.vendor_id = p_vendor_id
     AND NOT p.utilisee
     AND p.expire_le > NOW()
   ORDER BY p.created_at DESC
   LIMIT 10;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  2. ATTRIBUER — en résolvant le client par son code de présence
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.attribuer_relais(
  p_appel_id    UUID,
  p_receveur_id UUID,
  p_client_id   UUID,
  p_prix_net    INTEGER,
  p_product_id  UUID    DEFAULT NULL,
  p_mode        TEXT    DEFAULT 'marche',
  p_rang_choisi INTEGER DEFAULT 1,
  p_motif       TEXT    DEFAULT NULL,
  p_code_client TEXT    DEFAULT NULL
)
RETURNS TABLE (relais_id UUID, code TEXT, expire_le TIMESTAMPTZ, prix_paye INTEGER, bon INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pol public.platform_policy;
  v_dem UUID; v_rayon UUID; v_emet UUID; v_lib TEXT; v_client UUID; v_pres UUID;
  v_aff INTEGER; v_paye INTEGER; v_rem INTEGER; v_bon INTEGER; v_com INTEGER;
  v_dist INTEGER; v_code TEXT; v_id UUID; v_exp TIMESTAMPTZ; v_rang INTEGER;
BEGIN
  SELECT d.id, d.rayon_id, d.vendor_id, d.libelle
    INTO v_dem, v_rayon, v_emet, v_lib
    FROM public.appels a JOIN public.demandes d ON d.id = a.demande_id
   WHERE a.id = p_appel_id;
  IF v_dem IS NULL THEN RAISE EXCEPTION 'Appel introuvable'; END IF;
  IF v_emet = p_receveur_id THEN
    RAISE EXCEPTION 'Une boutique ne peut pas se relayer elle-même';
  END IF;

  -- Le client vient du code de présence, à défaut de l'identifiant direct.
  v_client := p_client_id;
  IF v_client IS NULL AND p_code_client IS NOT NULL THEN
    SELECT pc.id, pc.user_id INTO v_pres, v_client
      FROM public.presences_comptoir pc
     WHERE upper(pc.code) = upper(trim(p_code_client))
       AND pc.vendor_id = v_emet
       AND NOT pc.utilisee
       AND pc.expire_le > NOW();
    IF v_client IS NULL THEN
      RAISE EXCEPTION 'Code client inconnu, expiré, ou scanné à un autre comptoir';
    END IF;
  END IF;

  -- Sans client identifié, le relais existerait sans destinataire : il ne
  -- s'afficherait sur aucun téléphone, et personne ne pourrait le payer.
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Demande au client de scanner l''affiche du comptoir';
  END IF;

  SELECT * INTO pol FROM public.platform_policy WHERE id;

  v_aff  := ROUND(p_prix_net * (1 + pol.majoration_bps / 10000.0));
  v_rem  := ROUND(p_prix_net * pol.part_remise_bps     / 10000.0);
  v_bon  := ROUND(p_prix_net * pol.part_bon_bps        / 10000.0);
  v_com  := ROUND(p_prix_net * pol.part_buyticle_bps   / 10000.0);
  v_paye := v_aff - v_rem;

  SELECT public.distance_m(e.pickup_lat, e.pickup_lng, r.pickup_lat, r.pickup_lng)
    INTO v_dist
    FROM public.vendors e, public.vendors r
   WHERE e.id = v_emet AND r.id = p_receveur_id;

  SELECT c.rang INTO v_rang
    FROM public.classer_repondants(p_appel_id) c
   WHERE c.vendor_id = p_receveur_id;

  v_code := public.code_relais();
  v_exp  := NOW() + (pol.bon_validite_heures || ' hours')::INTERVAL;

  INSERT INTO public.relais (
    rayon_id, demande_id, appel_id, emetteur_id, receveur_id, client_id,
    product_id, libelle, prix_net, prix_affiche, prix_paye, remise, bon, commission,
    mode, distance_m, code, etat, rang_propose, rang_choisi, motif_ecart, expire_le)
  VALUES (
    v_rayon, v_dem, p_appel_id, v_emet, p_receveur_id, v_client,
    p_product_id, v_lib, p_prix_net, v_aff, v_paye, v_rem, v_bon, v_com,
    p_mode, v_dist, v_code, 'attribue', v_rang, p_rang_choisi, p_motif, v_exp)
  RETURNING id INTO v_id;

  -- La présence a servi : on la retire de la liste du comptoir, sinon le même
  -- client réapparaîtrait au relais suivant.
  IF v_pres IS NOT NULL THEN
    UPDATE public.presences_comptoir SET utilisee = TRUE WHERE id = v_pres;
  END IF;

  UPDATE public.demandes SET resultat = 'servie' WHERE id = v_dem;

  RETURN QUERY SELECT v_id, v_code, v_exp, v_paye, v_bon;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  3. QUI VOIT QUOI
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.presences_comptoir ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presences_parties ON public.presences_comptoir;
CREATE POLICY presences_parties ON public.presences_comptoir FOR SELECT
  USING (
    user_id = auth.uid()
    OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

GRANT EXECUTE ON FUNCTION public.signaler_presence(TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.ma_presence()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.presences_du_comptoir(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.attribuer_relais(UUID, UUID, UUID, INTEGER, UUID, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
