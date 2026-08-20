import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { Vide, Chargement } from '../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../lib/ui';
import Icone from '../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   FIDÉLITÉ ET PARRAINAGE

   Deux mécaniques, un seul écran, parce qu'elles répondent à la même
   question : qu'est-ce que je gagne à rester ?

   Les bonus se gagnent sur les commandes LIVRÉES, jamais sur les commandes
   passées. Créditer à la commande ferait des points sur des paniers annulés,
   et il faudrait les reprendre — ce qui se voit et se retient.
   ══════════════════════════════════════════════════════════════════════════ */

const SITE = 'https://www.buyticle.store';

export default function Fidelite() {
  const router = useRouter();
  const { user } = useSession();
  const [profil, setProfil] = useState(null);
  const [mouvements, setMouv] = useState(null);
  const [filleuls, setFilleuls] = useState(0);
  const [copie, setCopie] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => setProfil(data));
    supabase.from('loyalty_transactions')
      .select('id, type, points, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setMouv(data || []));
  }, [user]);

  useEffect(() => {
    if (!profil?.referral_code) return;
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('referral_code', profil.referral_code)
      .then(({ count }) => setFilleuls(count || 0));
  }, [profil?.referral_code]);

  if (!user) {
    return <Vide icone="cadeau" titre="Connecte-toi"
      texte="Pour gagner des bonus sur chaque commande livrée."
      bouton="Se connecter" onBouton={() => router.push('/connexion')} />;
  }

  const code = profil?.referral_code || '—';
  const lien = `${SITE}/ref/${code}`;
  const points = Number(profil?.loyalty_points || 0);

  const copier = async (texte, quoi) => {
    await Clipboard.setStringAsync(texte);
    setCopie(quoi); setTimeout(() => setCopie(''), 1800);
  };

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Bonus et parrainage</Text>
          </View>

          <View style={st.solde}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5, fontWeight: '700' }}>
              MES BONUS
            </Text>
            <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '800', marginTop: 3 }}>
              {points.toLocaleString('fr-FR')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
              soit {fcfa(points)} de remise sur ta prochaine commande
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        {/* Comment ça marche */}
        <View style={[st.bloc, { gap: 11 }]}>
          <Text style={S.titre}>Comment tu en gagnes</Text>
          {[
            ['panier', 'Sur tes achats', '2 % du montant, crédités quand la commande est livrée.'],
            ['etoile', 'Sur tes avis', 'Un avis sur un article reçu rapporte des points.'],
            ['personnes', 'Sur tes filleuls', 'Quand quelqu’un commande avec ton code.'],
          ].map(([i, t, d]) => (
            <View key={t} style={{ flexDirection: 'row', gap: 11 }}>
              <Icone nom={i} taille={19} couleur={C.marine} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.encre }}>{t}</Text>
                <Text style={{ fontSize: 12, color: C.gris, marginTop: 1, lineHeight: 16 }}>{d}</Text>
              </View>
            </View>
          ))}
          <Text style={{ fontSize: 11.5, color: C.gris, lineHeight: 16 }}>
            Les bonus arrivent à la livraison et pas à la commande : créditer plus
            tôt obligerait à les reprendre sur un panier annulé, et ça se retient.
          </Text>
        </View>

        {/* Le parrainage */}
        <View style={[st.bloc, { gap: 12 }]}>
          <Text style={S.titre}>Ton code de parrainage</Text>
          <View style={st.codeBloc}>
            <Text style={st.code}>{code}</Text>
            <Text style={{ fontSize: 11.5, color: C.gris, marginTop: 4 }}>{lien}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => copier(code, 'code')} style={[S.boutonFin, { flex: 1 }]}>
              <Text style={S.boutonFinTexte}>{copie === 'code' ? 'Copié' : 'Copier le code'}</Text>
            </Pressable>
            <Pressable
              onPress={() => Share.share({
                message: `Découvre Buyticle avec mon code ${code} : ${lien}`,
              })}
              style={[S.bouton, { flex: 1, paddingVertical: 12 }]}>
              <Text style={[S.boutonTexte, { fontSize: 14 }]}>Partager</Text>
            </Pressable>
          </View>

          <View style={st.compteur}>
            <Text style={{ fontSize: 13, color: C.gris }}>Commandes passées avec ton code</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.encre }}>{filleuls}</Text>
          </View>
        </View>

        {/* Le journal */}
        <View style={[st.bloc, { gap: 10 }]}>
          <Text style={S.titre}>Mes mouvements</Text>
          {mouvements === null ? <Chargement hauteur={80} />
            : mouvements.length === 0 ? (
              <Text style={S.sousTitre}>
                Rien encore. Tes premiers bonus arriveront à la livraison de ta
                première commande.
              </Text>
            ) : mouvements.map((m) => (
              <View key={m.id} style={st.mouvement}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, color: C.encre }}>
                    {m.type === 'redemption' ? 'Bonus utilisés' : 'Bonus gagnés'}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.gris }}>
                    {new Date(m.created_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 14, fontWeight: '800',
                  color: m.points >= 0 ? C.vert : C.encre,
                }}>
                  {m.points >= 0 ? '+' : ''}{Number(m.points).toLocaleString('fr-FR')}
                </Text>
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  solde: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: R.carte,
    padding: 16, marginTop: 14,
  },
  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
  codeBloc: {
    backgroundColor: C.champ, borderRadius: R.champ,
    padding: 14, alignItems: 'center',
  },
  code: { fontSize: 24, fontWeight: '800', letterSpacing: 4, color: C.encre },
  compteur: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.champ, borderRadius: R.champ, paddingHorizontal: 14, paddingVertical: 11,
  },
  mouvement: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.bord, paddingTop: 10,
  },
});
