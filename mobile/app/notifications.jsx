import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { enregistrerPourNotifications } from '../lib/notifications';
import { Vide, Chargement } from '../components/Base';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from '../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LES NOTIFICATIONS

   Rangées en quatre familles, comme dans la référence : commandes, offres,
   pour toi, nouveautés. Un flux unique mélange une promotion et « ton colis
   est arrivé », et on finit par ne plus rien ouvrir.

   La bannière du haut n'apparaît que si le téléphone les a refusées. C'est le
   seul moment où on a le droit d'insister : ici il est venu les chercher.
   ══════════════════════════════════════════════════════════════════════════ */

const FAMILLES = [
  { cle: 'commande', icone: 'colis', titre: 'Mes commandes', fond: '#2C6BED' },
  { cle: 'promo', icone: 'etiquette', titre: 'Offres et remises', fond: C.orange },
  { cle: 'perso', icone: 'cadeau', titre: 'Pour toi', fond: '#00897B' },
  { cle: 'appli', icone: 'eclair', titre: 'Nouveautés', fond: '#7B1FA2' },
];

export default function Notifications() {
  const router = useRouter();
  const { user, vendor } = useSession();
  const [liste, setListe] = useState(null);
  const [famille, setFamille] = useState(null);
  const [autorise, setAutorise] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setListe([]); return; }
      // On lit les notifications du relais, seule source réelle aujourd'hui.
      const { data } = vendor
        ? await supabase.rpc('mes_notifications', { p_vendor_id: vendor.id, p_limite: 50 })
        : { data: [] };
      setListe((data || []).map((n) => ({
        id: n.id, famille: n.genre === 'appel' ? 'commande' : 'perso',
        titre: n.titre, corps: n.corps, lien: n.lien, date: n.created_at,
      })));
    })();
  }, [user, vendor]);

  const activer = async () => {
    const r = await enregistrerPourNotifications(vendor?.id);
    setAutorise(!!r.jeton);
  };

  const filtree = famille ? (liste || []).filter((n) => n.famille === famille) : (liste || []);
  const compte = (c) => (liste || []).filter((n) => n.famille === c).length;

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Notifications</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        {!autorise && (
          <Pressable onPress={activer} style={st.alerte}>
            <Icone nom="cloches" taille={21} couleur={C.orange} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.encre }}>
                Les notifications sont coupées
              </Text>
              <Text style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>
                Tu ne sauras pas quand ta commande arrive. Touche pour les activer.
              </Text>
            </View>
          </Pressable>
        )}

        {/* Les familles */}
        <View style={{ paddingHorizontal: E.page, gap: 10 }}>
          {FAMILLES.map((f) => (
            <Pressable key={f.cle}
              onPress={() => setFamille(famille === f.cle ? null : f.cle)}
              style={[st.famille, famille === f.cle && { borderColor: C.orange }]}>
              <View style={[st.familleIcone, { backgroundColor: f.fond }]}>
                <Icone nom={f.icone} taille={20} couleur="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.encre }}>{f.titre}</Text>
                <Text style={{ fontSize: 12, color: C.gris, marginTop: 1 }}>
                  {compte(f.cle) > 0 ? `${compte(f.cle)} nouvelle${compte(f.cle) > 1 ? 's' : ''}` : 'Rien de neuf'}
                </Text>
              </View>
              {compte(f.cle) > 0 && (
                <View style={st.pastille}>
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                    {compte(f.cle)}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Le contenu */}
        {liste === null ? <Chargement /> : filtree.length === 0 ? (
          <Vide icone="cloche" titre="Rien pour l’instant"
            texte="Tes notifications de commande, tes offres et tes bonus arriveront ici." />
        ) : (
          <View style={{ marginTop: 16, paddingHorizontal: E.page, gap: 10 }}>
            {filtree.map((n) => (
              <Pressable key={n.id} onPress={() => n.lien && router.push(n.lien)} style={st.notif}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.encre }}>{n.titre}</Text>
                {!!n.corps && (
                  <Text style={{ fontSize: 13, color: C.gris, marginTop: 3, lineHeight: 18 }}>
                    {n.corps}
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: C.grisClair, marginTop: 6 }}>
                  {new Date(n.date).toLocaleString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },

  alerte: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: '#FFF6E5', borderWidth: 1, borderColor: '#FFE0A3',
    borderRadius: R.carte, padding: 13, marginHorizontal: E.page, marginBottom: 14,
  },

  famille: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 12,
    borderWidth: 1.5, borderColor: 'transparent', ...OMBRE,
  },
  familleIcone: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  pastille: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },

  notif: { backgroundColor: C.carte, borderRadius: R.carte, padding: 13, ...OMBRE },
});
