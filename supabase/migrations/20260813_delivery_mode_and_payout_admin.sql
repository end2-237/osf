-- ════════════════════════════════════════════════════════════════════════════
--  MODE DE LIVRAISON & TRAITEMENT DES RETRAITS
--
--  1. Chaque boutique choisit qui livre : elle-même, ou Buyticle Delivery.
--  2. Le solde en tient compte : quand Buyticle livre, c'est la plateforme qui
--     encaisse l'argent du paiement à la livraison — elle le doit donc au
--     vendeur, au même titre que le mobile money.
--  3. Fonctions de traitement des demandes de retrait pour le super-admin.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  1. MODE DE LIVRAISON
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'self';

UPDATE public.vendors SET delivery_mode = 'self' WHERE delivery_mode IS NULL;

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_delivery_mode_valid;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_delivery_mode_valid
  CHECK (delivery_mode IN ('self', 'buyticle'));

COMMENT ON COLUMN public.vendors.delivery_mode IS
  'self = la boutique livre et encaisse elle-même le cash ; '
  'buyticle = Buyticle Delivery livre et encaisse pour elle.';

-- ════════════════════════════════════════════════════════════════════════════
--  2. SOLDE — tient compte du mode de livraison
--     · mobile money : toujours encaissé par la plateforme
--     · à la livraison : encaissé par la plateforme UNIQUEMENT si Buyticle
--       livre, et seulement une fois la commande livrée
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vendor_balance(p_vendor_id UUID)
RETURNS TABLE (collected BIGINT, withdrawn BIGINT, pending BIGINT, available BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collected BIGINT; v_withdrawn BIGINT; v_pending BIGINT; v_mode TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(delivery_mode, 'self') INTO v_mode
  FROM public.vendors WHERE id = p_vendor_id;

  SELECT COALESCE(SUM(o.total_amount), 0) INTO v_collected
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id
    AND (
      -- Encaissé en ligne par la plateforme dès que le paiement est validé.
      (o.payment_method IN ('orange_money', 'mtn_momo')
       AND o.status IN ('paid', 'shipped', 'in_transit', 'delivered'))
      OR
      -- Cash remis au livreur Buyticle : dû au vendeur une fois livré.
      (v_mode = 'buyticle'
       AND o.payment_method NOT IN ('orange_money', 'mtn_momo')
       AND o.status = 'delivered')
    );

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status = 'paid';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status IN ('pending', 'processing');

  RETURN QUERY SELECT v_collected, v_withdrawn, v_pending,
                      GREATEST(v_collected - v_withdrawn - v_pending, 0);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  3. TRAITEMENT DES RETRAITS — super-admin
-- ════════════════════════════════════════════════════════════════════════════

-- Liste des demandes avec le nom de la boutique, sans exposer la table
-- `vendor_payout_settings` au client.
CREATE OR REPLACE FUNCTION public.admin_payouts(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, vendor_id UUID, shop_name TEXT, vendor_email TEXT,
  amount INTEGER, method TEXT, phone TEXT, status TEXT,
  note TEXT, reference TEXT,
  requested_at TIMESTAMPTZ, processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT p.id, p.vendor_id, v.shop_name, v.email,
         p.amount, p.method, p.phone, p.status,
         p.note, p.reference, p.requested_at, p.processed_at
  FROM public.vendor_payouts p
  JOIN public.vendors v ON v.id = p.vendor_id
  WHERE p_status IS NULL OR p.status = p_status
  ORDER BY
    CASE p.status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
    p.requested_at DESC;
END;
$$;

-- Changement de statut d'une demande. Les transitions sont contrôlées : une
-- demande déjà versée ou refusée ne se rouvre pas.
CREATE OR REPLACE FUNCTION public.process_payout(
  p_payout_id UUID,
  p_status    TEXT,
  p_reference TEXT DEFAULT NULL,
  p_note      TEXT DEFAULT NULL
)
RETURNS public.vendor_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_current TEXT; v_row public.vendor_payouts;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_status NOT IN ('pending', 'processing', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;

  SELECT status INTO v_current FROM public.vendor_payouts WHERE id = p_payout_id;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_current IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'Cette demande est déjà clôturée (%)', v_current;
  END IF;

  UPDATE public.vendor_payouts
     SET status       = p_status,
         reference    = COALESCE(NULLIF(p_reference, ''), reference),
         note         = COALESCE(NULLIF(p_note, ''), note),
         processed_at = CASE WHEN p_status IN ('paid', 'rejected') THEN NOW() ELSE processed_at END
   WHERE id = p_payout_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payouts(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.process_payout(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_payouts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;
