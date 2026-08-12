-- ════════════════════════════════════════════════════════════════════════════
--  TERMINER UNE COURSE
--
--  Démarrer ne suffisait pas : une course a trois moments, et chacun change ce
--  qu'il reste à faire.
--    1. PARTIR   — le livreur quitte sa position, cap sur la boutique ;
--    2. RÉCUPÉRER — il a le colis en main, le premier trajet est derrière lui ;
--    3. LIVRER   — le client a reçu, la course est close.
--
--  Une seule fonction porte les trois pas, donc un seul jeu de règles d'accès
--  et un seul endroit où l'ordre est vérifié : on ne livre pas un colis qu'on
--  n'a pas récupéré, et on ne rouvre pas une course close.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  REJOUABLE DANS N'IMPORTE QUEL ORDRE
--
--  PostgreSQL refuse un CREATE OR REPLACE qui change la forme du retour, et
--  deux signatures d'une même fonction rendraient chaque appel ambigu. On
--  efface donc d'abord toutes les signatures des fonctions que ce fichier
--  redéfinit — quel que soit l'état de la base, et quel que soit l'ordre dans
--  lequel les fichiers ont été appliqués.
-- ════════════════════════════════════════════════════════════════════════════
DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('advance_course', 'delivery_feed')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.picked_up_at IS
  'Quand le livreur a pris le colis à la boutique. Sépare les deux trajets.';

-- ════════════════════════════════════════════════════════════════════════════
--  AVANCER D'UN PAS
--
--  p_step : 'start' | 'pickup' | 'finish'
--  Renvoie l'état complet de la course, pour que l'écran n'ait pas à deviner.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_course(
  p_order_id UUID,
  p_step     TEXT,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  status            TEXT,
  course_started_at TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID; v_courier UUID; v_cuser UUID;
  v_started TIMESTAMPTZ; v_picked TIMESTAMPTZ; v_status TEXT;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  IF p_step NOT IN ('start', 'pickup', 'finish') THEN
    RAISE EXCEPTION 'Étape inconnue : %', p_step;
  END IF;

  SELECT o.vendor_id, o.courier_id, o.course_started_at, o.picked_up_at, o.status
    INTO v_vendor, v_courier, v_started, v_picked, v_status
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  -- Trois personnes peuvent faire avancer une course : celui qui la porte,
  -- la boutique concernée, et l'admin.
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

  -- L'ordre des pas est vérifié ici, pas dans l'écran : un colis se récupère
  -- avant d'être livré, quelle que soit la façon dont l'appel arrive.
  IF p_step IN ('pickup', 'finish') AND v_started IS NULL THEN
    RAISE EXCEPTION 'La course n''a pas encore démarré';
  END IF;
  IF p_step = 'finish' AND v_picked IS NULL THEN
    RAISE EXCEPTION 'Marque d''abord le colis comme récupéré';
  END IF;

  IF p_step = 'start' THEN
    SELECT * INTO r FROM public.delivery_rates WHERE id;
    v_lat := COALESCE(p_lat, r.hub_lat);
    v_lng := COALESCE(p_lng, r.hub_lng);

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

  ELSE   -- finish
    -- `delivered_at` est posé par le déclencheur `orders_stamp_delivered`.
    UPDATE public.orders o
       SET status = 'delivered'
     WHERE o.id = p_order_id;
  END IF;

  RETURN QUERY
  SELECT o.status::TEXT, o.course_started_at, o.picked_up_at, o.delivered_at,
         o.origin_lat, o.origin_lng
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE FLUX EXPOSE L'ÉTAPE DE RAMASSE
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delivery_feed()
RETURNS TABLE (
  id                UUID,
  order_number      TEXT,
  status            TEXT,
  created_at        TIMESTAMPTZ,
  total_amount      NUMERIC,
  client_name       TEXT,
  client_address    TEXT,
  client_lat        DOUBLE PRECISION,
  client_lng        DOUBLE PRECISION,
  pickup_lat        DOUBLE PRECISION,
  pickup_lng        DOUBLE PRECISION,
  shop_name         TEXT,
  delivery_mode     TEXT,
  dropoff_km        NUMERIC,
  delivered_at      TIMESTAMPTZ,
  course_fee        INTEGER,
  courier_id        UUID,
  courier_name      TEXT,
  courier_phone     TEXT,
  course_started_at TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  client_phone      TEXT,
  can_manage        BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, o.status::TEXT, o.created_at,
         o.total_amount::NUMERIC,
         o.client_name::TEXT, o.client_address::TEXT, o.client_lat, o.client_lng,
         COALESCE(o.pickup_lat, v.pickup_lat),
         COALESCE(o.pickup_lng, v.pickup_lng),
         v.shop_name::TEXT,
         COALESCE(o.delivery_mode, v.delivery_mode, 'self')::TEXT,
         o.dropoff_km::NUMERIC,
         o.delivered_at,
         (COALESCE(o.pickup_fee, 0) + COALESCE(o.dropoff_fee, 0))::INTEGER,
         o.courier_id, c.full_name::TEXT, c.phone::TEXT,
         o.course_started_at, o.picked_up_at, o.origin_lat, o.origin_lng,
         o.client_phone::TEXT,
         (public.is_super_admin()
          OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id)))
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  WHERE o.status NOT IN ('cancelled', 'payment_failed')
    AND (
      (public.is_super_admin()
       AND COALESCE(o.delivery_mode, v.delivery_mode) = 'buyticle')
      OR o.driver_id = auth.uid()
      OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id))
    )
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_feed() FROM anon;
GRANT EXECUTE ON FUNCTION public.delivery_feed() TO authenticated;
