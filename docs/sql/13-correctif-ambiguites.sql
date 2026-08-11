-- ════════════════════════════════════════════════════════════════════════════
--  CORRECTIF — « column reference "origin_lat" is ambiguous »
--
--  Les noms déclarés dans RETURNS TABLE sont des variables de sortie visibles
--  dans tout le corps de la fonction. Quand l'un d'eux porte le nom d'une
--  colonne touchée par la requête, PostgreSQL ne sait plus lequel on désigne
--  et refuse d'exécuter :
--
--      SET origin_lat = COALESCE(origin_lat, v_lat)
--                                 ^^^^^^^^^^ la variable, ou la colonne ?
--
--  La correction est d'aliaser la table mise à jour et de préfixer chaque
--  lecture de colonne. Les cibles de SET restent nues : PostgreSQL exige
--  qu'elles soient des colonnes, donc elles ne sont jamais ambiguës.
--
--  Trois fonctions étaient touchées :
--    · start_course   — origin_lat, origin_lng, status  (l'erreur remontée)
--    · assign_courier — courier_id, assigned_at
--    · take_course    — courier_id
--  Et delivery_view lisait `WHERE id = …` sans préfixe, avec `id` en sortie.
--
--  Aucune signature ne change : les écrans n'ont rien à adapter.
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  1. DÉMARRER UNE COURSE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.start_course(
  p_order_id UUID,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  started_at TIMESTAMPTZ, origin_lat DOUBLE PRECISION, origin_lng DOUBLE PRECISION, status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_courier UUID; v_cuser UUID;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, o.courier_id INTO v_vendor, v_courier
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;

  SELECT * INTO r FROM public.delivery_rates WHERE id;
  v_lat := COALESCE(p_lat, r.hub_lat);
  v_lng := COALESCE(p_lng, r.hub_lng);

  -- L'alias `o` lève toute ambiguïté : à droite du signe égal, `o.origin_lat`
  -- ne peut désigner que la colonne.
  UPDATE public.orders o
     SET course_started_at = COALESCE(o.course_started_at, NOW()),
         origin_lat        = COALESCE(o.origin_lat, v_lat),
         origin_lng        = COALESCE(o.origin_lng, v_lng),
         status            = CASE WHEN o.status IN ('delivered', 'cancelled', 'payment_failed')
                                  THEN o.status ELSE 'in_transit' END
   WHERE o.id = p_order_id;

  RETURN QUERY
  SELECT o2.course_started_at, o2.origin_lat, o2.origin_lng, o2.status::TEXT
  FROM public.orders o2 WHERE o2.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  2. ATTRIBUER
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assign_courier(
  p_order_id   UUID,
  p_courier_id UUID
)
RETURNS TABLE (courier_id UUID, courier_name TEXT, assigned_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
  v_cv UUID; v_cuser UUID; v_cname TEXT; v_active BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;

  IF v_mode IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  v_admin := public.is_super_admin();
  IF NOT v_admin AND NOT public.owns_vendor(v_vendor) THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  IF p_courier_id IS NULL THEN
    UPDATE public.orders o
       SET courier_id = NULL, driver_id = NULL, assigned_at = NULL
     WHERE o.id = p_order_id;
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT c.vendor_id, c.user_id, c.full_name, c.is_active
    INTO v_cv, v_cuser, v_cname, v_active
  FROM public.couriers c WHERE c.id = p_courier_id;

  IF v_cname IS NULL THEN RAISE EXCEPTION 'Livreur introuvable'; END IF;
  IF NOT v_active     THEN RAISE EXCEPTION 'Ce livreur n''est plus actif'; END IF;

  IF v_mode = 'buyticle' THEN
    IF v_cv IS NOT NULL THEN
      RAISE EXCEPTION 'Cette commande est confiée à Buyticle Delivery : elle revient à un livreur Buyticle';
    END IF;
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Seul Buyticle attribue les courses qui lui sont confiées';
    END IF;
  ELSE
    IF v_cv IS DISTINCT FROM v_vendor THEN
      RAISE EXCEPTION 'Ce livreur n''appartient pas à cette boutique';
    END IF;
  END IF;

  UPDATE public.orders o
     SET courier_id  = p_courier_id,
         driver_id   = v_cuser,
         assigned_at = NOW()
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT p_courier_id, v_cname::TEXT, NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.assign_courier(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_courier(UUID, UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  3. PRENDRE LA COURSE SOI-MÊME
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.take_course(p_order_id UUID)
RETURNS TABLE (courier_id UUID, courier_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
  v_scope  UUID;
  v_id     UUID; v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;
  IF v_mode IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  v_admin := public.is_super_admin();

  IF v_mode = 'buyticle' THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Cette course est confiée à Buyticle Delivery';
    END IF;
    v_scope := NULL;
  ELSE
    IF NOT (v_admin OR public.owns_vendor(v_vendor)) THEN
      RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
    END IF;
    v_scope := v_vendor;
  END IF;

  SELECT c.id, c.full_name INTO v_id, v_name
  FROM public.couriers c
  WHERE c.user_id = auth.uid()
    AND c.vendor_id IS NOT DISTINCT FROM v_scope
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Moi')
      INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

    INSERT INTO public.couriers AS c (vendor_id, user_id, full_name, created_by)
    VALUES (v_scope, auth.uid(), COALESCE(v_name, 'Moi'), auth.uid())
    RETURNING c.id, c.full_name INTO v_id, v_name;
  ELSE
    UPDATE public.couriers c SET is_active = TRUE
     WHERE c.id = v_id AND NOT c.is_active;
  END IF;

  UPDATE public.orders o
     SET courier_id = v_id, driver_id = auth.uid(), assigned_at = NOW()
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_id, v_name::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.take_course(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.take_course(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. VUE DU SUIVI — `id` était lu sans préfixe alors qu'il est en sortie
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delivery_view(p_order_id UUID)
RETURNS TABLE (
  id             UUID,
  order_number   TEXT,
  status         TEXT,
  created_at     TIMESTAMPTZ,
  total_amount   NUMERIC,
  payment_method TEXT,
  delivery_mode  TEXT,
  client_name    TEXT,
  client_phone   TEXT,
  client_address TEXT,
  client_lat     DOUBLE PRECISION,
  client_lng     DOUBLE PRECISION,
  pickup_lat     DOUBLE PRECISION,
  pickup_lng     DOUBLE PRECISION,
  pickup_label   TEXT,
  shop_name      TEXT,
  shop_phone     TEXT,
  vendor_id      UUID,
  driver_id      UUID,
  driver_name    TEXT,
  pickup_km      NUMERIC,
  dropoff_km     NUMERIC,
  pickup_fee     INTEGER,
  dropoff_fee    INTEGER,
  delivered_at   TIMESTAMPTZ,
  driver_phone   TEXT,
  viewer_role    TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role TEXT; v_vendor UUID; v_driver UUID; v_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT TRUE, o.vendor_id, o.driver_id INTO v_exists, v_vendor, v_driver
  FROM public.orders o WHERE o.id = p_order_id;

  IF NOT COALESCE(v_exists, FALSE) THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  v_role := CASE
    WHEN public.is_super_admin()                THEN 'admin'
    WHEN v_driver = auth.uid()                  THEN 'driver'
    WHEN v_vendor IS NOT NULL
         AND public.owns_vendor(v_vendor)       THEN 'vendor'
    ELSE NULL
  END;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.order_number::TEXT, o.status::TEXT, o.created_at,
         o.total_amount::NUMERIC, o.payment_method::TEXT,
         COALESCE(o.delivery_mode, v.delivery_mode, 'self')::TEXT,
         o.client_name::TEXT, o.client_phone::TEXT, o.client_address::TEXT,
         o.client_lat, o.client_lng,
         COALESCE(o.pickup_lat, v.pickup_lat),
         COALESCE(o.pickup_lng, v.pickup_lng),
         v.pickup_label::TEXT, v.shop_name::TEXT, v.phone::TEXT,
         o.vendor_id, o.driver_id, p.full_name::TEXT,
         o.pickup_km::NUMERIC, o.dropoff_km::NUMERIC,
         o.pickup_fee::INTEGER, o.dropoff_fee::INTEGER,
         o.delivered_at, p.phone::TEXT,
         v_role
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.profiles p ON p.id = o.driver_id
  WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_view(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delivery_view(UUID) TO authenticated;
