import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { enregistrerPourNotifications } from '../../lib/notifications';
import { Champ, Chargement } from '../../components/Base';
import { C, R, S, E, OMBRE } from '../../lib/ui';

/* LES RÉGLAGES DE LA BOUTIQUE. Le bloc des numéros de retrait est en premier :
   c'est le seul qui bloque de l'argent quand il n'est pas rempli. */
export default function ReglagesVendeur() {
  const router = useRouter();
  const { vendor, rafraichir } = useSession();
  const [form, setForm] = useState(null);
  const [momo, setMomo] = useState({ momo_orange_number: '', momo_mtn_number: '' });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [notif, setNotif] = useState(null);

  useEffect(() => {
    if (!vendor?.id) return;
    setForm({
      shop_name: vendor.shop_name || '',
      pickup_label: vendor.pickup_label || '',
      delivery_zones: vendor.delivery_zones || '',
      whatsapp: vendor.whatsapp || '',
    });
    supabase.from('vendor_payout_settings').select('*').eq('vendor_id', vendor.id).maybeSingle()
      .then(({ data }) => data && setMomo({
        momo_orange_number: data.momo_orange_number || '',
        momo_mtn_number: data.momo_mtn_number || '',
      }));
  }, [vendor?.id]);

  if (!form) return <View style={S.page}><Chargement hauteur={400} /></View>;

  const enregistrerMomo = async () => {
    setBusy('momo'); setMsg(null);
    const { error } = await supabase.from('vendor_payout_settings')
      .upsert({ vendor_id: vendor.id, ...momo }, { onConflict: 'vendor_id' });
    setBusy('');
    setMsg(error ? { t: 'err', m: error.message } : { t: 'ok', m: 'Numéros enregistrés.' });
  };

  const enregistrerBoutique = async () => {
    setBusy('boutique'); setMsg(null);
    const { error } = await supabase.from('vendors').update({
      shop_name: form.shop_name.trim(),
      pickup_label: form.pickup_label.trim() || null,
      delivery_zones: form.delivery_zones.trim() || null,
    }).eq('id', vendor.id);
    setBusy('');
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMsg({ t: 'ok', m: 'Boutique mise à jour.' });
    rafraichir?.();
  };

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Text style={{ color: '#FFF', fontSize: 24 }}>‹</Text>
            </Pressable>
            <Text style={st.titre}>Réglages</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        <View style={[st.bloc, { gap: 12 }]}>
          <View>
            <Text style={S.titre}>Où tu reçois ton argent</Text>
            <Text style={[S.sousTitre, { marginTop: 3 }]}>
              Sans numéro, aucun retrait n’est possible. C’est le seul réglage
              qui bloque de l’argent.
            </Text>
          </View>
          <Champ label="Orange Money" value={momo.momo_orange_number} keyboardType="numeric"
            onChangeText={(v) => setMomo((m) => ({ ...m, momo_orange_number: v.replace(/\D/g,'') }))}
            placeholder="6XX XX XX XX" />
          <Champ label="MTN MoMo" value={momo.momo_mtn_number} keyboardType="numeric"
            onChangeText={(v) => setMomo((m) => ({ ...m, momo_mtn_number: v.replace(/\D/g,'') }))}
            placeholder="6XX XX XX XX" />
          <Pressable onPress={enregistrerMomo} disabled={busy === 'momo'}
            style={[S.bouton, busy === 'momo' && S.boutonEteint]}>
            <Text style={S.boutonTexte}>Enregistrer</Text>
          </Pressable>
        </View>

        <View style={[st.bloc, { gap: 12 }]}>
          <Text style={S.titre}>Ma boutique</Text>
          <Champ label="Nom de la boutique" value={form.shop_name}
            onChangeText={(v) => setForm((f) => ({ ...f, shop_name: v }))} />
          <Champ label="Repère du comptoir" value={form.pickup_label}
            onChangeText={(v) => setForm((f) => ({ ...f, pickup_label: v }))}
            placeholder="Allée 3, face au dépôt de ciment"
            aide="C’est ce que lit un client relayé pour te trouver." />
          <Champ label="Zones de livraison" value={form.delivery_zones}
            onChangeText={(v) => setForm((f) => ({ ...f, delivery_zones: v }))}
            placeholder="Akwa, Bonapriso, Deido" />
          <Pressable onPress={enregistrerBoutique} disabled={busy === 'boutique'}
            style={[S.bouton, busy === 'boutique' && S.boutonEteint]}>
            <Text style={S.boutonTexte}>Enregistrer</Text>
          </Pressable>
        </View>

        <View style={[st.bloc, { gap: 10 }]}>
          <Text style={S.titre}>Notifications</Text>
          <Text style={S.sousTitre}>
            Sans elles, tu ne sauras pas qu’un voisin cherche un article que tu
            as. Trente secondes pour répondre : c’est ce délai qui décide de ce
            que le rayon te rapporte.
          </Text>
          <Pressable onPress={async () => setNotif(await enregistrerPourNotifications(vendor.id))}
            style={S.boutonFin}>
            <Text style={S.boutonFinTexte}>Vérifier les notifications</Text>
          </Pressable>
          {!!notif && (
            <Text style={{ fontSize: 13, color: notif.jeton ? C.vert : C.orange }}>
              {notif.jeton ? 'Actives. Ton téléphone est enregistré.'
                : 'Refusées ou indisponibles — autorise-les dans les réglages Android.'}
            </Text>
          )}
        </View>

        {!!msg && (
          <Text style={{ fontSize: 13, textAlign: 'center', color: msg.t === 'err' ? C.rouge : C.vert }}>
            {msg.m}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
});
