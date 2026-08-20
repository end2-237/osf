import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Barre, Vide } from '../components/Base';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from '../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   MES AVIS

   Deux listes, et la seconde compte plus que la première.

   « À noter » rassemble les articles livrés sur lesquels rien n'a été écrit.
   Sans ce rappel, un avis ne se laisse jamais : personne n'ouvre une
   application pour aller noter un achat de la semaine dernière. C'est en le
   montrant, à côté de ce qu'on a déjà écrit, qu'on en obtient.

   On ne demande jamais d'avis avant la livraison. Un avis écrit à la commande
   ne parle pas de l'article — il parle de l'attente.
   ══════════════════════════════════════════════════════════════════════════ */

function Etoiles({ n = 0, taille = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icone key={i} nom={i < n ? 'etoile' : 'etoileVide'} taille={taille}
          couleur={i < n ? C.jaune : C.grisClair} />
      ))}
    </View>
  );
}

export default function Avis() {
  const router = useRouter();
  const { user } = useSession();

  const [avis, setAvis] = useState(null);
  const [aNoter, setANoter] = useState([]);

  useEffect(() => {
    if (!user) { setAvis([]); return; }
    (async () => {
      const { data: mes } = await supabase.from('reviews')
        .select('*, product:products(id, name, img)')
        .eq('user_id', user.id).order('created_at', { ascending: false });
      setAvis(mes || []);

      // Les articles livrés qui n'ont pas encore d'avis. On passe par les
      // lignes de commande plutôt que par les produits : c'est ce qu'on a
      // vraiment reçu, pas ce qu'on a regardé.
      const { data: cmd } = await supabase.from('orders')
        .select('id, status, items:order_items(product_id, product_name, product_img)')
        .eq('user_id', user.id).eq('status', 'delivered');

      const dejaNotes = new Set((mes || []).map((r) => r.product_id));
      const vus = new Set();
      const reste = [];
      for (const o of cmd || []) {
        for (const it of o.items || []) {
          if (!it.product_id || dejaNotes.has(it.product_id) || vus.has(it.product_id)) continue;
          vus.add(it.product_id);
          reste.push({ id: it.product_id, name: it.product_name, img: it.product_img });
        }
      }
      setANoter(reste);
    })();
  }, [user]);

  if (!user) {
    return (
      <View style={S.page}>
        <Barre titre="Mes avis" />
        <Vide icone="etoile" titre="Connecte-toi"
          texte="Tes avis sont rattachés à ton compte."
          bouton="Se connecter" onBouton={() => router.push('/connexion')} />
      </View>
    );
  }

  if (avis === null) {
    return (
      <View style={S.page}>
        <Barre titre="Mes avis" />
        <ActivityIndicator style={{ marginTop: 40 }} color={C.marine} />
      </View>
    );
  }

  if (!avis.length && !aNoter.length) {
    return (
      <View style={S.page}>
        <Barre titre="Mes avis" />
        <Vide icone="etoile" titre="Aucun avis pour l’instant"
          texte="Les avis s’écrivent après une commande livrée — on ne demande jamais ce que vaut un article avant que tu l’aies en main."
          bouton="Voir mes commandes" onBouton={() => router.push('/commandes')} />
      </View>
    );
  }

  return (
    <View style={S.page}>
      <Barre titre="Mes avis"
        sousTitre={`${avis.length} écrit${avis.length > 1 ? 's' : ''}${aNoter.length ? ` · ${aNoter.length} à noter` : ''}`} />

      <ScrollView contentContainerStyle={{ padding: E.page, paddingBottom: 40, gap: 12 }}>
        {aNoter.length > 0 && (
          <View style={{ gap: 9 }}>
            <Text style={S.titre}>À noter</Text>
            <Text style={{ fontSize: 12.5, color: C.gris, lineHeight: 17 }}>
              Tu les as reçus. Deux lignes suffisent — et c’est ce qui aide le
              suivant à choisir.
            </Text>
            {aNoter.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/produit/${p.id}`)}
                style={st.carte}>
                <View style={st.vignette}>
                  {p.img
                    ? <Image source={{ uri: p.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    : <Icone nom="colis" taille={22} couleur={C.grisClair} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.nom} numberOfLines={2}>{p.name}</Text>
                  <Text style={st.inviter}>Donner mon avis</Text>
                </View>
                <Icone nom="suite" taille={18} couleur={C.grisClair} />
              </Pressable>
            ))}
          </View>
        )}

        {avis.length > 0 && (
          <View style={{ gap: 9, marginTop: aNoter.length ? 8 : 0 }}>
            <Text style={S.titre}>Ce que j’ai écrit</Text>
            {avis.map((r) => (
              <Pressable key={r.id}
                onPress={() => r.product_id && router.push(`/produit/${r.product_id}`)}
                style={[st.carte, { alignItems: 'flex-start' }]}>
                <View style={st.vignette}>
                  {r.product?.img
                    ? <Image source={{ uri: r.product.img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    : <Icone nom="colis" taille={22} couleur={C.grisClair} />}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={st.nom} numberOfLines={1}>{r.product?.name || 'Article'}</Text>
                  <Etoiles n={Number(r.rating) || 0} />
                  {!!r.text && <Text style={st.texte} numberOfLines={4}>{r.text}</Text>}
                  <Text style={st.date}>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString('fr-FR',
                          { day: 'numeric', month: 'long', year: 'numeric' })
                      : ''}
                    {r.approved === false ? ' · en attente de validation' : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  carte: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 11, ...OMBRE,
  },
  vignette: {
    width: 54, height: 54, borderRadius: R.vignette, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  nom: { fontSize: 13.5, fontWeight: '600', color: C.encre, lineHeight: 18 },
  inviter: { fontSize: 12, fontWeight: '700', color: C.orange, marginTop: 3 },
  texte: { fontSize: 12.5, color: C.encre, lineHeight: 17 },
  date: { fontSize: 11, color: C.gris },
});
