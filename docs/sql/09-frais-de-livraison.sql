-- ════════════════════════════════════════════════════════════════════════════
--  QUI GARDE LES FRAIS DE LIVRAISON
--
--  Règle décidée :
--    · Buyticle ne prélève AUCUNE commission sur les ventes. Le vendeur touche
--      100 % du prix des articles.
--    · Les frais de livraison suivent celui qui livre :
--        – la boutique livre elle-même  → les frais lui reviennent ;
--        – Buyticle Delivery livre      → les frais reviennent à Buyticle.
--
--  Rappel de ce que contiennent les colonnes, parce que le calcul en dépend :
--    · orders.total_amount = prix des articles pour CE vendeur, remises et
--      code promo déjà déduits. Les frais de livraison n'y sont PAS.
--    · orders.delivery_fee = frais de livraison de cette commande, à part.
--    · Le client paie la somme des deux.
--
--  Conséquence sur le solde :
--    · Boutique qui livre + paiement en ligne : Buyticle a encaissé articles
--      ET frais, mais les frais sont au vendeur → on les lui ajoute.
--    · Boutique qui livre + paiement à la livraison : le vendeur encaisse tout
--      lui-même, la plateforme ne lui doit rien → la commande ne compte pas.
--    · Buyticle Delivery : on ne reverse que les articles, jamais les frais,
--      quel que soit le moyen de paiement.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

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

  SELECT COALESCE(SUM(
           -- Aucune commission : le prix des articles revient entièrement
           -- à la boutique.
           o.total_amount
           -- Les frais ne sont dus au vendeur que s'il livre lui-même. Ce
           -- cas ne concerne que les commandes payées en ligne : le filtre
           -- ci-dessous écarte déjà celles payées à la livraison, qu'il a
           -- encaissées de sa main.
           + CASE WHEN v_mode = 'self' THEN COALESCE(o.delivery_fee, 0) ELSE 0 END
         ), 0) INTO v_collected
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

COMMENT ON FUNCTION public.vendor_balance(UUID) IS
  'Ce que Buyticle doit à une boutique : 100 % du prix des articles encaissé '
  'pour elle (aucune commission), plus les frais de livraison uniquement si '
  'elle livre elle-même, moins ce qui lui a déjà été versé ou est en cours.';
