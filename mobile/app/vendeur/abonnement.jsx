import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { soldeBon } from '../../lib/relais';
import { Chargement } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';
import Icone from '../../components/Icone';

/* L'ABONNEMENT. Ce qu'il ouvre est dit en clair, sans superlatif : un
   commerçant paie ce qu'il comprend. Et le bon de relais peut le régler — la
   seule dépense qui ne lui coûte pas un billet. */
export default function Abonnement() {
  const router = useRouter();
  const { vendor, rafraichir } = useSession();
  const [plans, setPlans] = useState(null);
  const [attente, setAttente] = useState(null);
  const [bon, setBon] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const charger = async () => {
    if (!vendor?.id) return;
    const [p, a, b] = await Promise.all([
      supabase.from('subscription_plans').select('*').order('price'),
      supabase.from('subscription_orders').select('*').eq('vendor_id', vendor.id)
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      soldeBon(vendor.id),
    ]);
    setPlans(p.data || []);
    setAttente(a.data || null);
    setBon(b.data?.[0] || null);
  };
  useEffect(() => { charger(); }, [vendor?.id]);

  const demander = async (plan) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('request_subscription', {
      p_vendor_id: vendor.id, p_plan: plan.id, p_months: 1, p_method: 'monetbil',
    });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    charger();
  };

  const payerAvecBon = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('payer_abonnement_avec_bon', { p_vendor_id: vendor.id });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMsg({ t: 'ok', m: 'Abonnement réglé avec ton bon.' });
    await charger(); rafraichir?.();
  };

  if (plans === null) return <View style={S.page}><Chargement hauteur={400} /></View>;

  const actuel = vendor?.plan || 'free';
  const soldeBonus = Number(bon?.solde || 0);

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Abonnement</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 3 }}>
            Forfait actuel : {actuel === 'free' ? 'Gratuit' : actuel}
            {vendor?.plan_expires_at
              ? ` · jusqu’au ${new Date(vendor.plan_expires_at).toLocaleDateString('fr-FR')}` : ''}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        {!!attente && (
          <View style={[st.bloc, { gap: 10, borderWidth: 1.5, borderColor: C.orange }]}>
            <Text style={S.titre}>Un forfait attend son règlement</Text>
            <Text style={S.sousTitre}>
              {attente.to_plan} · {attente.months} mois · {fcfa(attente.amount)}
            </Text>
            <Pressable onPress={payerAvecBon}
              disabled={busy || soldeBonus < attente.amount}
              style={[S.bouton, (busy || soldeBonus < attente.amount) && S.boutonEteint]}>
              <Text style={[S.boutonTexte, (busy || soldeBonus < attente.amount) && S.boutonEteintTexte]}>
                Régler avec mon bon ({fcfa(soldeBonus)})
              </Text>
            </Pressable>
            {soldeBonus < attente.amount && (
              <Text style={{ fontSize: 11.5, color: C.gris }}>
                Il te manque {fcfa(attente.amount - soldeBonus)} de bon. Tu peux
                aussi le régler en Mobile Money depuis le site.
              </Text>
            )}
          </View>
        )}

        {plans.map((p) => {
          const cest = p.id === actuel;
          return (
            <View key={p.id} style={[st.bloc, cest && { borderWidth: 1.5, borderColor: C.marine }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: C.encre }}>
                  {p.name}
                </Text>
                {cest && (
                  <View style={st.actuel}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>Ton forfait</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: C.encre, marginTop: 6 }}>
                {p.price ? `${fcfa(p.price)} / mois` : 'Gratuit'}
              </Text>
              {!!p.description && (
                <Text style={{ fontSize: 13, color: C.gris, marginTop: 6, lineHeight: 18 }}>
                  {p.description}
                </Text>
              )}
              {!cest && p.price > 0 && (
                <Pressable onPress={() => demander(p)} disabled={busy}
                  style={[S.bouton, { marginTop: 12 }, busy && S.boutonEteint]}>
                  <Text style={S.boutonTexte}>Passer à {p.name}</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {!!msg && (
          <Text style={{
            fontSize: 13, textAlign: 'center',
            color: msg.t === 'err' ? C.rouge : C.vert,
          }}>{msg.m}</Text>
        )}
      </ScrollView>
    </View>
  );
}
const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 15,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
  actuel: {
    backgroundColor: C.marine, borderRadius: R.puce,
    paddingHorizontal: 10, paddingVertical: 4,
  },
});
