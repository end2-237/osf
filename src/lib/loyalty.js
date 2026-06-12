import { supabase } from './supabase';

export const awardOrderPoints = async (userId, orderId, orderAmount) => {
  if (!userId || !orderId || !orderAmount) return;
  const pts = Math.floor(orderAmount / 100);
  if (pts <= 0) return;
  const { error } = await supabase.from('loyalty_transactions').insert({
    user_id:      userId,
    type:         'purchase',
    points:       pts,
    reference_id: orderId,
    description:  `Achat #${orderId.slice(-8).toUpperCase()} — ${Number(orderAmount).toLocaleString()} FCFA`,
  });
  if (error?.code === '23505') return; // already recorded (unique index)
  if (error) { console.error('[loyalty] insert error:', error.code, error.message, error.details, error.hint); return; }
  const { error: rpcErr } = await supabase.rpc('award_loyalty_points', { p_user_id: userId, p_delta: pts });
  if (rpcErr) console.error('[loyalty] rpc error:', rpcErr);
};
