-- ════════════════════════════════════════════════════════════════════════════
--  DOSSIER LIVREUR (KYC) & FICHE DE REMISE
--
--  1. UN LIVREUR N'EST PLUS UNE SIMPLE LIGNE DE CARNET
--     Quelqu'un à qui on confie des colis et parfois du cash mérite un
--     dossier : pièce d'identité recto-verso, photo du visage, véhicule.
--     Le dossier est déposé par le candidat, examiné par un admin, et ce
--     n'est qu'à l'approbation que la fiche livreur est créée.
--
--  2. LE CAS DU CLIENT QUI NE PEUT PAS VALIDER
--     Le code de livraison suppose un client qui a son téléphone, du réseau,
--     et son compte sous la main. Ça ne couvre pas tout : téléphone déchargé,
--     commande reçue par un voisin, client qui ne sait pas lire un écran.
--     La fiche de remise prend le relais — nom, pièce d'identité, signature,
--     photo du colis remis — et vaut preuve au même titre que le code.
--
--         proof = 'code'  → code saisi par le client
--         proof = 'slip'  → fiche signée avec pièce d'identité et photo
--         proof = 'none'  → rien : le doute profite au client
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DROP FUNCTION IF EXISTS public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT);
DROP FUNCTION IF EXISTS public.admin_returns(TEXT);

-- ════════════════════════════════════════════════════════════════════════════
--  1. DOSSIER DE CANDIDATURE LIVREUR
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.courier_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- NULL = candidature chez Buyticle. Sinon, livreur d'une boutique précise.
  vendor_id     UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  city          TEXT DEFAULT 'Douala',
  vehicle_type  TEXT,                     -- moto | voiture | tricycle | velo | pieds
  vehicle_plate TEXT,
  id_type       TEXT,                     -- cni | passeport | permis
  id_number     TEXT,
  id_front_url  TEXT,
  id_back_url   TEXT,
  selfie_url    TEXT,
  licence_url   TEXT,                     -- permis de conduire, si véhicule
  status        TEXT NOT NULL DEFAULT 'pending',
  review_note   TEXT,
  reviewed_by   UUID REFERENCES auth.users(id),
  reviewed_at   TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courier_applications DROP CONSTRAINT IF EXISTS courier_apps_status_valid;
ALTER TABLE public.courier_applications
  ADD CONSTRAINT courier_apps_status_valid
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS courier_apps_status_idx ON public.courier_applications(status);
CREATE INDEX IF NOT EXISTS courier_apps_user_idx   ON public.courier_applications(user_id);

ALTER TABLE public.courier_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courier_apps_insert ON public.courier_applications;
DROP POLICY IF EXISTS courier_apps_select ON public.courier_applications;
DROP POLICY IF EXISTS courier_apps_update ON public.courier_applications;

-- Dépôt : le formulaire tourne parfois juste après signUp, avant que l'e-mail
-- soit confirmé — donc parfois sans session. Même choix que pour les vendeurs.
CREATE POLICY courier_apps_insert ON public.courier_applications
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY courier_apps_select ON public.courier_applications
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_super_admin()
    OR (vendor_id IS NOT NULL AND public.owns_vendor(vendor_id))
  );

CREATE POLICY courier_apps_update ON public.courier_applications
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── Approbation : c'est ici que la fiche livreur naît ─────────────────────
CREATE OR REPLACE FUNCTION public.approve_courier_application(
  p_app_id UUID,
  p_note   TEXT DEFAULT NULL
)
RETURNS public.couriers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE a public.courier_applications; c public.couriers;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT * INTO a FROM public.courier_applications WHERE id = p_app_id;
  IF NOT FOUND            THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF a.status = 'approved' THEN RAISE EXCEPTION 'Ce dossier est déjà approuvé'; END IF;

  INSERT INTO public.couriers (vendor_id, user_id, full_name, phone, avatar_url, created_by)
  VALUES (a.vendor_id, a.user_id, a.full_name, a.phone, a.selfie_url, auth.uid())
  RETURNING * INTO c;

  UPDATE public.courier_applications
     SET status = 'approved', review_note = COALESCE(NULLIF(BTRIM(p_note), ''), review_note),
         reviewed_by = auth.uid(), reviewed_at = NOW()
   WHERE id = p_app_id;

  -- Le drapeau ouvre la console de livraison à ce compte.
  IF a.user_id IS NOT NULL THEN
    UPDATE public.profiles SET is_driver = TRUE WHERE id = a.user_id;
  END IF;

  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_courier_application(
  p_app_id UUID,
  p_note   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF COALESCE(BTRIM(p_note), '') = '' THEN
    RAISE EXCEPTION 'Explique le motif du refus : le candidat le lira';
  END IF;

  UPDATE public.courier_applications
     SET status = 'rejected', review_note = BTRIM(p_note),
         reviewed_by = auth.uid(), reviewed_at = NOW()
   WHERE id = p_app_id AND status <> 'approved';

  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier introuvable ou déjà approuvé'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_courier_application(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.reject_courier_application(UUID, TEXT)  FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_courier_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_courier_application(UUID, TEXT)  TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  2. FICHE DE REMISE
--
--  Une fiche vaut preuve parce qu'elle porte trois choses qu'on ne fabrique
--  pas depuis un canapé : une identité, une signature, et une photo du colis
--  à l'endroit et à l'heure de la remise.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.delivery_slips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id       UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES auth.users(id),
  -- Qui a réceptionné. Pas forcément le client : un voisin, un gardien…
  recipient_name   TEXT NOT NULL,
  recipient_phone  TEXT,
  recipient_id_type   TEXT,               -- cni | passeport | permis | autre
  recipient_id_number TEXT,
  is_third_party   BOOLEAN NOT NULL DEFAULT FALSE,
  relationship     TEXT,                  -- lien avec le client si tiers
  -- Les pièces. `signature_url` et `parcel_photo_url` pour une fiche remplie
  -- à l'écran ; `paper_slip_url` quand la fiche est papier et qu'on la
  -- photographie avec le colis.
  signature_url    TEXT,
  parcel_photo_url TEXT,
  paper_slip_url   TEXT,
  -- Où et quand, tels que le téléphone du livreur les a vus.
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.delivery_slips IS
  'Preuve de remise quand le code n''a pas pu être saisi : identité du '
  'réceptionnaire, signature, photo du colis remis.';

ALTER TABLE public.delivery_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_slips_read  ON public.delivery_slips;
DROP POLICY IF EXISTS delivery_slips_admin ON public.delivery_slips;

-- Une fiche contient un numéro de pièce d'identité : elle n'est pas publique.
-- La voient l'admin, la boutique concernée, le livreur, et le client lui-même.
CREATE POLICY delivery_slips_read ON public.delivery_slips
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.user_id = auth.uid()
             OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id))
             OR o.driver_id = auth.uid())
    )
  );

-- L'écriture passe par `advance_course` seul : une fiche sans course clôturée
-- n'aurait aucun sens.
CREATE POLICY delivery_slips_admin ON public.delivery_slips
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- La preuve accepte un troisième niveau.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_proof_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_proof_valid
  CHECK (delivery_proof IN ('none', 'code', 'slip'));

-- ════════════════════════════════════════════════════════════════════════════
--  3. CLORE AVEC UN CODE, OU AVEC UNE FICHE
--
--  p_slip attend :
--    { "recipient_name": "…", "recipient_phone": "…",
--      "recipient_id_type": "cni", "recipient_id_number": "…",
--      "is_third_party": false, "relationship": "…",
--      "signature_url": "…", "parcel_photo_url": "…", "paper_slip_url": "…",
--      "lat": 4.05, "lng": 9.76, "note": "…" }
--
--  Une fiche n'est retenue comme preuve que si elle porte une identité ET au
--  moins une image. Une fiche à moitié remplie ne vaut pas mieux que rien, et
--  on préfère le dire tout de suite plutôt qu'au moment du litige.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_course(
  p_order_id UUID,
  p_step     TEXT,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_code     TEXT DEFAULT NULL,
  p_slip     JSONB DEFAULT NULL
)
RETURNS TABLE (
  status            TEXT,
  course_started_at TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  delivery_proof    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID; v_courier UUID; v_cuser UUID;
  v_started TIMESTAMPTZ; v_picked TIMESTAMPTZ; v_status TEXT; v_code TEXT;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
  v_name TEXT; v_idnum TEXT; v_has_image BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  IF p_step NOT IN ('start', 'pickup', 'finish') THEN
    RAISE EXCEPTION 'Étape inconnue : %', p_step;
  END IF;

  SELECT o.vendor_id, o.courier_id, o.course_started_at, o.picked_up_at,
         o.status, o.delivery_code
    INTO v_vendor, v_courier, v_started, v_picked, v_status, v_code
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_status IN ('cancelled', 'payment_failed') THEN
    RAISE EXCEPTION 'Cette commande est annulée';
  END IF;
  IF v_status = 'delivered' THEN
    RAISE EXCEPTION 'Cette course est déjà terminée';
  END IF;
  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;
  IF p_step IN ('pickup', 'finish') AND v_started IS NULL THEN
    RAISE EXCEPTION 'La course n''a pas encore démarré';
  END IF;
  IF p_step = 'finish' AND v_picked IS NULL THEN
    RAISE EXCEPTION 'Marque d''abord le colis comme récupéré';
  END IF;

  IF p_step = 'start' THEN
    SELECT * INTO r FROM public.delivery_rates dr WHERE dr.id;
    v_lat := COALESCE(p_lat, r.hub_lat);
    v_lng := COALESCE(p_lng, r.hub_lng);
    PERFORM public.ensure_delivery_code(p_order_id);

    UPDATE public.orders o
       SET course_started_at = COALESCE(o.course_started_at, NOW()),
           origin_lat        = COALESCE(o.origin_lat, v_lat),
           origin_lng        = COALESCE(o.origin_lng, v_lng),
           status            = 'in_transit'
     WHERE o.id = p_order_id;

  ELSIF p_step = 'pickup' THEN
    UPDATE public.orders o
       SET picked_up_at = COALESCE(o.picked_up_at, NOW()),
           status       = 'in_transit'
     WHERE o.id = p_order_id;

  ELSE
    -- a) Le code, quand le client peut le donner : la preuve la plus simple.
    IF p_code IS NOT NULL AND BTRIM(p_code) <> '' THEN
      IF v_code IS NULL OR BTRIM(p_code) <> v_code THEN
        RAISE EXCEPTION 'Code incorrect. Demande au client le code affiché dans son suivi.';
      END IF;
      UPDATE public.orders o
         SET status = 'delivered', code_verified_at = NOW(), delivery_proof = 'code'
       WHERE o.id = p_order_id;

    -- b) La fiche, quand il ne le peut pas.
    ELSIF p_slip IS NOT NULL THEN
      v_name  := NULLIF(BTRIM(p_slip ->> 'recipient_name'), '');
      v_idnum := NULLIF(BTRIM(p_slip ->> 'recipient_id_number'), '');
      v_has_image := COALESCE(NULLIF(BTRIM(p_slip ->> 'parcel_photo_url'), ''),
                              NULLIF(BTRIM(p_slip ->> 'paper_slip_url'), '')) IS NOT NULL;

      IF v_name IS NULL THEN
        RAISE EXCEPTION 'Note le nom de la personne qui reçoit le colis';
      END IF;
      IF v_idnum IS NULL THEN
        RAISE EXCEPTION 'Note le numéro de pièce d''identité du réceptionnaire';
      END IF;
      IF NOT v_has_image THEN
        RAISE EXCEPTION 'Ajoute une photo : le colis remis, ou la fiche papier signée';
      END IF;

      INSERT INTO public.delivery_slips (
        order_id, courier_id, created_by,
        recipient_name, recipient_phone, recipient_id_type, recipient_id_number,
        is_third_party, relationship,
        signature_url, parcel_photo_url, paper_slip_url, lat, lng, note)
      VALUES (
        p_order_id, v_courier, auth.uid(),
        v_name,
        NULLIF(BTRIM(p_slip ->> 'recipient_phone'), ''),
        COALESCE(NULLIF(BTRIM(p_slip ->> 'recipient_id_type'), ''), 'cni'),
        v_idnum,
        COALESCE((p_slip ->> 'is_third_party')::BOOLEAN, FALSE),
        NULLIF(BTRIM(p_slip ->> 'relationship'), ''),
        NULLIF(BTRIM(p_slip ->> 'signature_url'), ''),
        NULLIF(BTRIM(p_slip ->> 'parcel_photo_url'), ''),
        NULLIF(BTRIM(p_slip ->> 'paper_slip_url'), ''),
        COALESCE((p_slip ->> 'lat')::DOUBLE PRECISION, p_lat),
        COALESCE((p_slip ->> 'lng')::DOUBLE PRECISION, p_lng),
        NULLIF(BTRIM(p_slip ->> 'note'), ''))
      ON CONFLICT (order_id) DO NOTHING;

      UPDATE public.orders o
         SET status = 'delivered', delivery_proof = 'slip'
       WHERE o.id = p_order_id;

    -- c) Ni l'un ni l'autre : la remise n'est pas prouvée.
    ELSE
      UPDATE public.orders o
         SET status = 'delivered', delivery_proof = 'none'
       WHERE o.id = p_order_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT o.status::TEXT, o.course_started_at, o.picked_up_at, o.delivered_at,
         o.origin_lat, o.origin_lng, o.delivery_proof::TEXT
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. « JAMAIS REÇU » FACE À UNE FICHE SIGNÉE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_return(
  p_order_id UUID,
  p_reason   TEXT,
  p_kind     TEXT DEFAULT 'other'
)
RETURNS TABLE (return_status TEXT, deadline TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_delivered TIMESTAMPTZ;
  v_ret TEXT; v_window INTEGER; v_deadline TIMESTAMPTZ;
  v_proof TEXT; v_confirmed TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF COALESCE(BTRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Explique la raison du retour';
  END IF;
  IF COALESCE(p_kind, 'other') NOT IN ('not_received', 'damaged', 'wrong_item', 'other') THEN
    RAISE EXCEPTION 'Motif inconnu';
  END IF;

  SELECT o.user_id, o.status, o.delivered_at, o.return_status,
         o.delivery_proof, o.client_confirmed_at
    INTO v_user, v_status, v_delivered, v_ret, v_proof, v_confirmed
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Le retour n''est possible qu''une fois la commande livrée';
  END IF;
  IF v_ret <> 'none' THEN
    RAISE EXCEPTION 'Une demande de retour existe déjà pour cette commande';
  END IF;
  IF v_confirmed IS NOT NULL THEN
    RAISE EXCEPTION 'Tu as déjà confirmé la bonne réception de cette commande';
  END IF;

  IF p_kind = 'not_received' AND v_proof = 'code' THEN
    RAISE EXCEPTION 'Le code de livraison a été saisi lors de la remise : la réception est établie. Choisis le motif qui correspond au problème réel.';
  END IF;
  IF p_kind = 'not_received' AND v_proof = 'slip' THEN
    RAISE EXCEPTION 'Une fiche de remise signée existe pour cette commande. Si elle a été signée par quelqu''un d''autre que toi, ouvre le litige avec le motif « Autre » en l''expliquant.';
  END IF;

  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;
  v_deadline := COALESCE(v_delivered, NOW()) + (v_window || ' hours')::INTERVAL;
  IF NOW() > v_deadline THEN
    RAISE EXCEPTION 'Le délai de % h est dépassé : le retour n''est plus possible', v_window;
  END IF;

  UPDATE public.orders o
     SET return_status       = 'requested',
         return_kind         = COALESCE(p_kind, 'other'),
         return_reason       = BTRIM(p_reason),
         return_requested_at = NOW(),
         funds_released_at   = NULL
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT 'requested'::TEXT, v_deadline;
END;
$$;

REVOKE ALL ON FUNCTION public.request_return(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_return(UUID, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. L'ARBITRAGE VOIT LA FICHE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_returns(p_status TEXT DEFAULT 'requested')
RETURNS TABLE (
  id              UUID,
  order_number    TEXT,
  shop_name       TEXT,
  vendor_id       UUID,
  client_name     TEXT,
  client_phone    TEXT,
  total_amount    NUMERIC,
  delivered_at    TIMESTAMPTZ,
  requested_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  return_status   TEXT,
  return_kind     TEXT,
  return_reason   TEXT,
  return_note     TEXT,
  funds_state     TEXT,
  delivery_proof  TEXT,
  client_disputes INTEGER,
  client_rejected INTEGER,
  vendor_disputes INTEGER,
  slip            JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.client_name::TEXT, o.client_phone::TEXT, o.total_amount::NUMERIC,
         o.delivered_at, o.return_requested_at, o.return_resolved_at,
         o.return_status::TEXT, o.return_kind::TEXT,
         o.return_reason::TEXT, o.return_note::TEXT,
         public.order_funds_state(o.id), o.delivery_proof::TEXT,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status <> 'none')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status = 'rejected')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.vendor_id = o.vendor_id AND x.return_status <> 'none')::INTEGER,
         (SELECT to_jsonb(s) FROM public.delivery_slips s WHERE s.order_id = o.id)
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.return_status <> 'none'
    AND (p_status IS NULL OR o.return_status = p_status)
  ORDER BY o.return_requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_returns(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_returns(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LES DOSSIERS VUS DE L'ADMIN
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_courier_applications(p_status TEXT DEFAULT 'pending')
RETURNS SETOF public.courier_applications
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN QUERY
  SELECT * FROM public.courier_applications ca
  WHERE p_status IS NULL OR ca.status = p_status
  ORDER BY ca.submitted_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_courier_applications(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_courier_applications(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. STOCKAGE DES PREUVES
--     Privé : ces images portent des visages, des pièces d'identité et des
--     adresses. Elles se consultent par URL signée, jamais en clair.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('delivery-proofs', 'delivery-proofs', FALSE, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Delivery proofs insert" ON storage.objects;
DROP POLICY IF EXISTS "Delivery proofs read"   ON storage.objects;

CREATE POLICY "Delivery proofs insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'delivery-proofs' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Delivery proofs read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'delivery-proofs' AND auth.role() = 'authenticated'
  );

-- ════════════════════════════════════════════════════════════════════════════
--  8. LIBÉRER AVANT L'HEURE, SUR PREUVE VALIDÉE
--
--  Les 48 h existent parce qu'on ne sait pas si la remise a eu lieu. Quand
--  une fiche signée est sous les yeux de l'admin — pièce d'identité, signature,
--  photo du colis — le doute est levé : attendre n'apporte plus rien et prive
--  la boutique de sa trésorerie sans raison.
--
--  L'admin valide, l'argent part. Un litige ouvert bloque toujours : celui-là
--  se règle par `resolve_return`, pas par un raccourci.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_release_funds(
  p_order_id UUID,
  p_note     TEXT DEFAULT NULL
)
RETURNS TABLE (funds_state TEXT, released_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status TEXT; v_ret TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT o.status, o.return_status INTO v_status, v_ret
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Cette commande n''est pas marquée livrée';
  END IF;
  IF v_ret IN ('requested', 'approved', 'returned') THEN
    RAISE EXCEPTION 'Un litige est ouvert : tranche-le d''abord';
  END IF;

  UPDATE public.orders o
     SET funds_released_at = COALESCE(o.funds_released_at, NOW()),
         return_note       = COALESCE(NULLIF(BTRIM(p_note), ''), o.return_note)
   WHERE o.id = p_order_id;

  RETURN QUERY
  SELECT public.order_funds_state(p_order_id), o.funds_released_at
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_release_funds(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_release_funds(UUID, TEXT) TO authenticated;

-- ── La file d'attente des remises à examiner ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_pending_proofs()
RETURNS TABLE (
  id             UUID,
  order_number   TEXT,
  shop_name      TEXT,
  client_name    TEXT,
  client_phone   TEXT,
  total_amount   NUMERIC,
  delivered_at   TIMESTAMPTZ,
  delivery_proof TEXT,
  courier_name   TEXT,
  hours_left     NUMERIC,
  slip           JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hold INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT pp.funds_hold_hours INTO v_hold FROM public.platform_policy pp WHERE pp.id;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT,
         o.client_name::TEXT, o.client_phone::TEXT, o.total_amount::NUMERIC,
         o.delivered_at, o.delivery_proof::TEXT, c.full_name::TEXT,
         ROUND(EXTRACT(EPOCH FROM (
           o.delivered_at + (v_hold || ' hours')::INTERVAL - NOW())) / 3600, 1),
         (SELECT to_jsonb(s) FROM public.delivery_slips s WHERE s.order_id = o.id)
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  WHERE o.status = 'delivered'
    AND o.return_status = 'none'
    AND o.funds_released_at IS NULL
    AND o.client_confirmed_at IS NULL
    AND o.delivered_at + (v_hold || ' hours')::INTERVAL > NOW()
  ORDER BY o.delivered_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pending_proofs() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_pending_proofs() TO authenticated;
