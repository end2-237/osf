-- Verrou court : en cas de table occupée, on échoue vite au lieu de bloquer.
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
       AND p.proname IN ('orders_status', 'track_order', 'vendor_sales_counts')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- Nombre de ventes par boutique — agrégat, aucune donnée personnelle.
CREATE OR REPLACE FUNCTION public.vendor_sales_counts()
RETURNS TABLE (vendor_id UUID, sales BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.vendor_id, COUNT(*)::BIGINT
  FROM public.orders o
  WHERE o.vendor_id IS NOT NULL
    AND o.status IN ('confirmed', 'paid', 'shipped', 'in_transit', 'delivered')
  GROUP BY o.vendor_id;
$$;

-- Statut de commandes dont on possède déjà l'identifiant (suivi du paiement).
-- Ne renvoie que id + statut : un identifiant deviné n'expose rien d'utile.
CREATE OR REPLACE FUNCTION public.orders_status(p_ids UUID[])
RETURNS TABLE (id UUID, status TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT o.id, o.status FROM public.orders o WHERE o.id = ANY(p_ids);
$$;

-- Suivi de commande invité : exige le numéro de commande ET le téléphone.
CREATE OR REPLACE FUNCTION public.track_order(p_reference TEXT, p_phone TEXT)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.orders o
  WHERE regexp_replace(COALESCE(o.client_phone, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')
    AND length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) >= 8
    AND (
      o.id::TEXT = p_reference
      OR COALESCE(o.order_number::TEXT, '') = p_reference
    )
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.vendor_balance(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.request_payout(UUID, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_sales_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_status(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO anon, authenticated;
