-- ════════════════════════════════════════════════════════════════════════════
--  SANS POSITION DE BOUTIQUE, PAS D'ITINÉRAIRE
--
--  Le devis retombait silencieusement sur la base Buyticle quand la boutique
--  n'avait pas enregistré son point. Deux conséquences, toutes deux fausses :
--    · le trajet « boutique → client » ne pouvait pas être tracé ;
--    · le client se voyait facturer une distance qui n'était pas la sienne.
--
--  Le devis refuse désormais, avec un motif que le panier affiche tel quel.
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
       AND p.proname IN ('quote_delivery')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

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
  v_found  BOOLEAN := FALSE;
  v_pk     NUMERIC; v_dk NUMERIC;
  v_pf     INTEGER; v_df INTEGER;
BEGIN
  SELECT * INTO r FROM public.delivery_rates WHERE id;

  SELECT TRUE, pickup_lat, pickup_lng INTO v_found, v_plat, v_plng
  FROM public.vendors WHERE id = p_vendor_id;

  IF NOT v_found THEN
    RETURN QUERY SELECT FALSE, 'Boutique introuvable', 0::NUMERIC, 0::NUMERIC, 0, 0, 0;
    RETURN;
  END IF;

  -- Le point de ramasse est le départ de l'itinéraire. Sans lui, il n'y a ni
  -- trajet à tracer ni distance à facturer : on ne devine pas.
  IF v_plat IS NULL OR v_plng IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'la boutique n''a pas encore enregistré sa position sur la carte',
      0::NUMERIC, 0::NUMERIC, 0, 0, 0;
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
      format('trop loin — %s km, nous livrons jusqu''à %s km', v_dk, r.max_km),
      v_pk, v_dk, 0, 0, 0;
    RETURN;
  END IF;

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
--  Une boutique ne peut pas confier ses livraisons à Buyticle Delivery sans
--  avoir dit d'où part la marchandise. La règle est portée par la base : elle
--  tient même si quelqu'un écrit dans la table sans passer par l'écran.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_buyticle_needs_pickup;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_buyticle_needs_pickup
  CHECK (
    delivery_mode IS DISTINCT FROM 'buyticle'
    OR (pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL)
  )
  NOT VALID;   -- les boutiques déjà en base ne sont pas rejetées rétroactivement

COMMENT ON CONSTRAINT vendors_buyticle_needs_pickup ON public.vendors IS
  'Buyticle Delivery part de la boutique : son point doit être connu.';
