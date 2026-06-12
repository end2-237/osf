import { supabase } from './supabase';

const COMMISSION_RATE = 0.05;

export const recordAffiliateCommission = async (referralCode, orderId, orderAmount, buyerUserId = null) => {
  if (!referralCode || !orderId || !orderAmount) return;
  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', referralCode.toUpperCase())
    .maybeSingle();
  if (!referrer?.id) return;
  if (buyerUserId && referrer.id === buyerUserId) return; // no self-referral
  const commissionAmount = Math.round(orderAmount * COMMISSION_RATE);
  if (commissionAmount <= 0) return;
  await supabase.from('affiliate_commissions').insert({
    referrer_user_id: referrer.id,
    order_id:         orderId,
    buyer_user_id:    buyerUserId || null,
    order_amount:     orderAmount,
    commission_amount: commissionAmount,
    commission_rate:  COMMISSION_RATE,
    status:           'pending',
  }).then(() => {});
};
