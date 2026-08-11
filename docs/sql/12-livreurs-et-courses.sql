-- ════════════════════════════════════════════════════════════════════════════
--  LIVREURS, ATTRIBUTION ET DÉMARRAGE DE COURSE
--
--  Deux familles de livreurs cohabitent :
--    · ceux de Buyticle (vendor_id NULL) — l'admin les gère et les attribue
--      aux commandes que les boutiques nous confient ;
--    · ceux d'une boutique — elle seule les voit et les attribue, pour les
--      commandes qu'elle livre elle-même.
--  Dans les deux cas « je démarre moi-même » reste possible : on s'attribue
--  la course sans passer par un tiers.
--
--  Une course part de là où se trouve celui qui la fait, pas de la boutique :
--  il doit d'abord aller chercher le colis. Le point de départ est donc figé
--  au démarrage — position réelle si le navigateur la donne, siège Buyticle
--  sinon — et l'itinéraire compte trois points : où je suis, où je récupère,
--  où je livre.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  1. LES LIVREURS
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.couriers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = livreur Buyticle. Sinon, livreur propre à cette boutique.
  vendor_id  UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  -- Renseigné quand le livreur a un compte : il peut alors ouvrir la console.
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  avatar_url TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS couriers_vendor_idx ON public.couriers(vendor_id);
CREATE INDEX IF NOT EXISTS couriers_user_idx   ON public.couriers(user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.couriers IS
  'Livreurs. vendor_id NULL = livreur Buyticle géré par l''admin ; sinon '
  'livreur appartenant à une boutique.';

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS couriers_read  ON public.couriers;
DROP POLICY IF EXISTS couriers_write ON public.couriers;

-- On voit les livreurs Buyticle, les siens, et soi-même.
CREATE POLICY couriers_read ON public.couriers
  FOR SELECT USING (
    vendor_id IS NULL
    OR public.owns_vendor(vendor_id)
    OR user_id = auth.uid()
    OR public.is_super_admin()
  );

-- On ne modifie que les siens ; les livreurs Buyticle sont à l'admin seul.
CREATE POLICY couriers_write ON public.couriers
  FOR ALL
  USING      (CASE WHEN vendor_id IS NULL THEN public.is_super_admin()
                   ELSE public.owns_vendor(vendor_id) OR public.is_super_admin() END)
  WITH CHECK (CASE WHEN vendor_id IS NULL THEN public.is_super_admin()
                   ELSE public.owns_vendor(vendor_id) OR public.is_super_admin() END);

-- ════════════════════════════════════════════════════════════════════════════
--  2. LA COURSE SUR LA COMMANDE
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_id        UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS course_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origin_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_lng        DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS orders_courier_idx ON public.orders(courier_id)
  WHERE courier_id IS NOT NULL;

COMMENT ON COLUMN public.orders.origin_lat IS
  'D''où le livreur est parti chercher le colis. Figé au démarrage.';

-- ════════════════════════════════════════════════════════════════════════════
--  3. QUI PEUT ÊTRE ATTRIBUÉ À CETTE COMMANDE
--
--  L'écran ne devine pas : la base répond, selon qui demande et selon le mode
--  de livraison choisi par la boutique.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assignable_couriers(p_order_id UUID)
RETURNS TABLE (
  id         UUID,
  full_name  TEXT,
  phone      TEXT,
  avatar_url TEXT,
  scope      TEXT,      -- 'buyticle' | 'boutique' | 'moi'
  is_me      BOOLEAN,
  active_runs INTEGER   -- courses déjà en cours, pour ne pas surcharger
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;

  IF v_vendor IS NULL AND v_mode IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  v_admin := public.is_super_admin();

  IF NOT v_admin AND NOT public.owns_vendor(v_vendor) THEN
    RAISE EXCEPTION 'Cette commande ne vous est pas accessible';
  END IF;

  RETURN QUERY
  SELECT c.id, c.full_name::TEXT, c.phone::TEXT, c.avatar_url::TEXT,
         CASE WHEN c.vendor_id IS NULL THEN 'buyticle' ELSE 'boutique' END::TEXT,
         (c.user_id IS NOT NULL AND c.user_id = auth.uid()),
         (SELECT COUNT(*) FROM public.orders o2
           WHERE o2.courier_id = c.id
             AND o2.status NOT IN ('delivered', 'cancelled', 'payment_failed'))::INTEGER
  FROM public.couriers c
  WHERE c.is_active
    AND (
      -- Commande confiée à Buyticle : nos livreurs, vus par l'admin.
      (v_mode = 'buyticle' AND c.vendor_id IS NULL AND v_admin)
      -- Commande livrée par la boutique : ses propres livreurs.
      OR (v_mode = 'self' AND c.vendor_id = v_vendor)
    )
  ORDER BY (c.user_id = auth.uid()) DESC NULLS LAST, c.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.assignable_couriers(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assignable_couriers(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. ATTRIBUER
--
--  p_courier_id NULL retire l'attribution. Le livreur doit appartenir au
--  périmètre du demandeur : un vendeur ne s'attribue pas un livreur Buyticle,
--  et l'admin ne dispose pas des livreurs d'une boutique.
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

  -- Retrait d'attribution
  IF p_courier_id IS NULL THEN
    UPDATE public.orders
       SET courier_id = NULL, driver_id = NULL, assigned_at = NULL
     WHERE id = p_order_id;
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

  UPDATE public.orders
     SET courier_id  = p_courier_id,
         driver_id   = v_cuser,          -- donne l'accès console au livreur
         assigned_at = NOW()
   WHERE id = p_order_id;

  RETURN QUERY SELECT p_courier_id, v_cname::TEXT, NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.assign_courier(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_courier(UUID, UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. DÉMARRER
--
--  Fige le point de départ et fait passer la commande en route. Sans position
--  transmise, on retient le siège Buyticle : mieux vaut un départ approximatif
--  et annoncé qu'un itinéraire sans origine.
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

  UPDATE public.orders
     SET course_started_at = COALESCE(course_started_at, NOW()),
         origin_lat        = COALESCE(origin_lat, v_lat),
         origin_lng        = COALESCE(origin_lng, v_lng),
         status            = CASE WHEN status IN ('delivered', 'cancelled', 'payment_failed')
                                  THEN status ELSE 'in_transit' END
   WHERE id = p_order_id;

  RETURN QUERY
  SELECT o.course_started_at, o.origin_lat, o.origin_lng, o.status::TEXT
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_course(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LES VUES DE LA CONSOLE — livreur, départ, démarrage
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.delivery_feed();

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
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
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
         o.course_started_at, o.origin_lat, o.origin_lng,
         -- Qui peut attribuer et démarrer cette course.
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

-- ════════════════════════════════════════════════════════════════════════════
--  7. « JE DÉMARRE MOI-MÊME »
--
--  Prendre la course soi-même ne devrait pas obliger à se créer d'abord une
--  fiche livreur. Cette fonction s'en charge : elle réutilise la fiche du
--  demandeur si elle existe, la crée sinon, dans le bon périmètre — Buyticle
--  pour l'admin, la boutique pour le vendeur — puis attribue.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.take_course(p_order_id UUID)
RETURNS TABLE (courier_id UUID, courier_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID; v_mode TEXT; v_admin BOOLEAN;
  v_scope  UUID;                    -- vendor_id de la fiche à utiliser
  v_id     UUID; v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.vendor_id, COALESCE(o.delivery_mode, v.delivery_mode, 'self')
    INTO v_vendor, v_mode
  FROM public.orders o LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.id = p_order_id;
  IF v_mode IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  v_admin := public.is_super_admin();

  -- Une course confiée à Buyticle se prend côté Buyticle ; une course de
  -- boutique se prend côté boutique. Le périmètre suit le mode, pas le rôle.
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

    INSERT INTO public.couriers (vendor_id, user_id, full_name, created_by)
    VALUES (v_scope, auth.uid(), COALESCE(v_name, 'Moi'), auth.uid())
    RETURNING id, full_name INTO v_id, v_name;
  ELSIF NOT EXISTS (SELECT 1 FROM public.couriers WHERE id = v_id AND is_active) THEN
    UPDATE public.couriers SET is_active = TRUE WHERE id = v_id;
  END IF;

  UPDATE public.orders
     SET courier_id = v_id, driver_id = auth.uid(), assigned_at = NOW()
   WHERE id = p_order_id;

  RETURN QUERY SELECT v_id, v_name::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.take_course(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.take_course(UUID) TO authenticated;
