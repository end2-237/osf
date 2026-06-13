import { supabase } from './supabase';

const COMMISSION_RATE    = 0.05;
const REFERRAL_BONUS_PTS = 200;

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

  // Record commission (unique constraint on order_id prevents duplicates)
  await supabase.from('affiliate_commissions').insert({
    referrer_user_id:  referrer.id,
    order_id:          orderId,
    buyer_user_id:     buyerUserId || null,
    order_amount:      orderAmount,
    commission_amount: commissionAmount,
    commission_rate:   COMMISSION_RATE,
    status:            'pending',
  }).then(() => {});

  // Bonus 200 pts si c'est la 1ère commande du filleul via ce parrain
  if (buyerUserId) {
    const { count } = await supabase
      .from('affiliate_commissions')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', referrer.id)
      .eq('buyer_user_id', buyerUserId);
    if (count === 1) {
      // C'est la toute première commande de ce filleul → bonus parrain
      await supabase.from('loyalty_transactions').insert({
        user_id:      referrer.id,
        type:         'referral_bonus',
        points:       REFERRAL_BONUS_PTS,
        reference_id: orderId,
      }).then(() => {});
      await supabase.rpc('award_loyalty_points', {
        p_user_id: referrer.id,
        p_delta:   REFERRAL_BONUS_PTS,
      });
    }
  }
};
