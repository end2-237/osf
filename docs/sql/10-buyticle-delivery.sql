-- ════════════════════════════════════════════════════════════════════════════
--  BUYTICLE DELIVERY — POSITIONS, TARIFS EN DEUX TRAJETS, ACCÈS AU SUIVI
--
--  1. Une livraison, c'est deux trajets, et chacun coûte :
--       · la RAMASSE   : notre livreur va jusqu'à la boutique
--       · la REMISE    : la boutique jusqu'au client
--     Les deux varient avec la distance, et chacun a son propre tarif.
--
--  2. Le prix est calculé EN BASE, jamais dans le navigateur. Le client
--     pourrait sinon s'annoncer à 200 m de la boutique et payer 500 F pour
--     une course de 20 km. La distance retenue est la distance à vol
--     d'oiseau corrigée d'un facteur de sinuosité : elle ne dépend d'aucun
--     service extérieur, donc elle est reproductible et non falsifiable.
--     Le tracé routier réel n'est affiché que pour l'œil.
--
--  3. Le suivi ne s'ouvre pas sans compte. `delivery_view` est la seule
--     porte : elle ne répond qu'au vendeur de la commande, au livreur
--     assigné, ou à un super-admin.
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
       AND p.proname IN ('delivery_feed', 'delivery_view', 'geo_km', 'quote_delivery', 'stamp_delivered_at')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. POSITIONS
-- ════════════════════════════════════════════════════════════════════════════

-- Le client enregistre son point avec son adresse : le livreur cherche une
-- porte, pas un quartier.
ALTER TABLE public.user_addresses
  ADD COLUMN IF NOT EXISTS lat            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geo_label      TEXT,
  ADD COLUMN IF NOT EXISTS geo_updated_at TIMESTAMPTZ;

-- La boutique : point de ramasse.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pickup_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_label   TEXT;

-- La commande fige les deux points ET le mode de livraison : la boutique peut
-- changer d'avis demain, la commande d'hier garde ses conditions.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS client_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_mode  TEXT,
  ADD COLUMN IF NOT EXISTS pickup_km      NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS dropoff_km     NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS pickup_fee     INTEGER,
  ADD COLUMN IF NOT EXISTS dropoff_fee    INTEGER,
  ADD COLUMN IF NOT EXISTS driver_id      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ;

-- Horodater la livraison : sans ça, « délai moyen » ne peut être qu'inventé.
CREATE OR REPLACE FUNCTION public.stamp_delivered_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_stamp_delivered ON public.orders;
CREATE TRIGGER orders_stamp_delivered
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_delivered_at();

CREATE INDEX IF NOT EXISTS orders_driver_idx ON public.orders(driver_id)
  WHERE driver_id IS NOT NULL;

-- Un livreur est un compte comme un autre, avec un drapeau.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT FALSE;

-- ════════════════════════════════════════════════════════════════════════════
--  2. TARIFS — une seule ligne, tenue par le super-admin
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.delivery_rates (
  id              BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),  -- ligne unique
  -- Trajet 1 : notre base → la boutique
  pickup_base     INTEGER NOT NULL DEFAULT 500,
  pickup_per_km   INTEGER NOT NULL DEFAULT 150,
  pickup_free_km  NUMERIC(6,2) NOT NULL DEFAULT 2,   -- km inclus dans la base
  -- Trajet 2 : la boutique → le client
  dropoff_base    INTEGER NOT NULL DEFAULT 700,
  dropoff_per_km  INTEGER NOT NULL DEFAULT 200,
  dropoff_free_km NUMERIC(6,2) NOT NULL DEFAULT 2,
  -- Garde-fous
  min_fee         INTEGER NOT NULL DEFAULT 1000,
  max_km          NUMERIC(6,2) NOT NULL DEFAULT 40,  -- au-delà, on ne livre pas
  road_factor     NUMERIC(4,2) NOT NULL DEFAULT 1.35,-- vol d'oiseau → route
  -- D'où partent nos livreurs
  hub_lat         DOUBLE PRECISION NOT NULL DEFAULT 4.0511,
  hub_lng         DOUBLE PRECISION NOT NULL DEFAULT 9.7679,
  hub_label       TEXT NOT NULL DEFAULT 'Akwa, Douala',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.delivery_rates (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.delivery_rates IS
  'Tarifs Buyticle Delivery. Une livraison = ramasse (base → boutique) + '
  'remise (boutique → client). Chaque trajet a sa base, ses km offerts et '
  'son prix au km.';

ALTER TABLE public.delivery_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_rates_read  ON public.delivery_rates;
DROP POLICY IF EXISTS delivery_rates_write ON public.delivery_rates;

-- Lisible de tous : le panier doit pouvoir afficher la grille tarifaire.
CREATE POLICY delivery_rates_read ON public.delivery_rates
  FOR SELECT USING (TRUE);

CREATE POLICY delivery_rates_write ON public.delivery_rates
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  3. DISTANCE — haversine, en kilomètres
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.geo_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ROUND(
    (6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
      COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
      POWER(SIN(RADIANS(lng2 - lng1) / 2), 2)
    )))::NUMERIC, 3);
$$;

GRANT EXECUTE ON FUNCTION public.geo_km(DOUBLE PRECISION, DOUBLE PRECISION,
                                        DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. DEVIS — le prix d'une course, calculé en base
--
--  Renvoie toujours une ligne. `serviceable` dit si la course est acceptée ;
--  quand elle ne l'est pas, `reason` explique pourquoi et le total vaut 0.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.quote_delivery(
  p_vendor_id UUID,
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION
)
RETURNS TABLE (
  serviceable  BOOLEAN,
  reason       TEXT,
  pickup_km    NUMERIC,
  dropoff_km   NUMERIC,
  pickup_fee   INTEGER,
  dropoff_fee  INTEGER,
  total_fee    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        public.delivery_rates;
  v_plat   DOUBLE PRECISION; v_plng DOUBLE PRECISION;
  v_pk     NUMERIC; v_dk NUMERIC;
  v_pf     INTEGER; v_df INTEGER;
BEGIN
  SELECT * INTO r FROM public.delivery_rates WHERE id;

  SELECT COALESCE(pickup_lat, r.hub_lat), COALESCE(pickup_lng, r.hub_lng)
    INTO v_plat, v_plng
  FROM public.vendors WHERE id = p_vendor_id;

  IF v_plat IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Boutique introuvable', 0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Position du client inconnue', 0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  -- Les routes ne sont pas des lignes droites : on corrige le vol d'oiseau.
  v_pk := ROUND(public.geo_km(r.hub_lat, r.hub_lng, v_plat, v_plng) * r.road_factor, 2);
  v_dk := ROUND(public.geo_km(v_plat,   v_plng,     p_lat,  p_lng)  * r.road_factor, 2);

  IF v_dk > r.max_km THEN
    RETURN QUERY SELECT FALSE,
      format('Trop loin : %s km, nous livrons jusqu''à %s km', v_dk, r.max_km),
      v_pk, v_dk, 0, 0, 0;
    RETURN;
  END IF;

  -- Chaque trajet : une base qui couvre les premiers kilomètres, puis au km.
  v_pf := r.pickup_base  + CEIL(GREATEST(v_pk - r.pickup_free_km,  0) * r.pickup_per_km);
  v_df := r.dropoff_base + CEIL(GREATEST(v_dk - r.dropoff_free_km, 0) * r.dropoff_per_km);

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_pk, v_dk, v_pf, v_df,
                      GREATEST(v_pf + v_df, r.min_fee);
END;
$$;

REVOKE ALL ON FUNCTION public.quote_delivery(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_delivery(UUID, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. SUIVI — la seule porte d'entrée du module
--
--  Pas de compte, pas de carte. Et un compte ne suffit pas : il faut être le
--  vendeur de la commande, son livreur, ou un super-admin.
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

  -- `id` est un nom de sortie : toute lecture de colonne doit être préfixée,
  -- sinon PostgreSQL ne sait pas si l'on parle de la variable ou de la table.
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
         -- Le mode figé à la commande fait foi ; à défaut, celui de la boutique.
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

-- ════════════════════════════════════════════════════════════════════════════
--  6. LISTE DES COURSES — ce que le module affiche à gauche
--
--  Un vendeur voit ses commandes, un livreur les siennes, l'admin voit toutes
--  celles qui passent par Buyticle Delivery.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delivery_feed()
RETURNS TABLE (
  id            UUID,
  order_number  TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ,
  total_amount  NUMERIC,
  client_name   TEXT,
  client_address TEXT,
  client_lat    DOUBLE PRECISION,
  client_lng    DOUBLE PRECISION,
  pickup_lat    DOUBLE PRECISION,
  pickup_lng    DOUBLE PRECISION,
  shop_name     TEXT,
  delivery_mode TEXT,
  dropoff_km    NUMERIC,
  delivered_at  TIMESTAMPTZ,
  course_fee    INTEGER,
  driver_id     UUID,
  driver_name   TEXT,
  driver_phone  TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

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
         o.driver_id, p.full_name::TEXT, p.phone::TEXT
  FROM public.orders o
  LEFT JOIN public.vendors  v ON v.id = o.vendor_id
  LEFT JOIN public.profiles p ON p.id = o.driver_id
  WHERE o.status NOT IN ('cancelled', 'payment_failed')
    AND (
      -- Admin : tout ce qui est confié à Buyticle Delivery.
      (public.is_super_admin()
       AND COALESCE(o.delivery_mode, v.delivery_mode) = 'buyticle')
      -- Livreur : ses courses.
      OR o.driver_id = auth.uid()
      -- Vendeur : ses commandes, qu'il livre lui-même ou non.
      OR (o.vendor_id IS NOT NULL AND public.owns_vendor(o.vendor_id))
    )
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_feed() FROM anon;
GRANT EXECUTE ON FUNCTION public.delivery_feed() TO authenticated;
