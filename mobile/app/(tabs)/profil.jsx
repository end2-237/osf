import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/session';
import { useBoutique } from '../../lib/boutique';
import { supabase } from '../../lib/supabase';
import { Ligne, Vide } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';
import Icone from '../../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LE PROFIL

   Structure de la référence : la carte de statut en haut avec les bonus et la
   progression vers le palier suivant, puis les listes.

   Une décision qui n'est pas dans la référence : le comptoir vendeur s'ouvre
   d'ici. Un commerçant est d'abord un client de la plateforme ; lui donner un
   sixième onglet réservé encombrerait l'écran des cent clients pour un
   commerçant. La notification d'appel, elle, y mène directement — c'est là
   que se joue la vitesse, pas dans la navigation.
   ══════════════════════════════════════════════════════════════════════════ */

const PALIERS = [
  { nom: 'Bronze', seuil: 0, couleur: '#B87333' },
  { nom: 'Orange', seuil: 100000, couleur: C.orange },
  { nom: 'Black', seuil: 500000, couleur: '#1A1A1A' },
];

export default function Profil() {
  const router = useRouter();
  const { user, vendor, deconnecter } = useSession();
  const { favoris, nbArticles } = useBoutique();

  const [profil, setProfil] = useState(null);
  const [nbCommandes, setNb] = useState(0);
  const [depense, setDepense] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => setProfil(data));
    supabase.from('orders').select('id, total_amount, status').eq('user_id', user.id)
      .then(({ data }) => {
        setNb(data?.length || 0);
        setDepense((data || [])
          .filter((o) => ['paid', 'shipped', 'in_transit', 'delivered'].includes(o.status))
          .reduce((s, o) => s + (Number(o.total_amount) || 0), 0));
      });
  }, [user]);

  if (!user) {
    return (
      <View style={S.page}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
          <View style={st.enTete}><Text style={st.titre}>Mon profil</Text></View>
        </SafeAreaView>
        <Vide icone="profil" titre="Connecte-toi"
          texte="Pour suivre tes commandes, garder tes favoris et gagner des bonus sur chaque achat."
          bouton="Se connecter" onBouton={() => router.push('/connexion')} />
      </View>
    );
  }

  const bonus = Number(profil?.loyalty_points || 0);
  const palierActuel = [...PALIERS].reverse().find((p) => depense >= p.seuil) || PALIERS[0];
  const suivant = PALIERS.find((p) => p.seuil > depense);
  const progression = suivant
    ? Math.min(1, (depense - palierActuel.seuil) / (suivant.seuil - palierActuel.seuil))
    : 1;

  const nom = profil?.full_name
    || (user.email || '').split('@')[0].replace(/^(\d{9,})$/, '$1');

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={st.avatar}>
              {profil?.avatar_url
                ? <Image source={{ uri: profil.avatar_url }} style={{ width: '100%', height: '100%' }} />
                : <Icone nom="profil" taille={24} couleur="#FFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.nom} numberOfLines={1}>{nom}</Text>
              <Text style={st.sousTitre}>{profil?.phone || user.email}</Text>
            </View>
            <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
              <Icone nom="cloche" taille={22} couleur="#FFF" />
            </Pressable>
          </View>

          <View style={st.bonusRangee}>
            <View style={st.bonusPuce}>
              <Text style={st.bonusValeur}>{bonus.toLocaleString('fr-FR')}</Text>
              <Text style={st.bonusLibelle}>bonus</Text>
            </View>
            <View style={st.bonusPuce}>
              <Text style={st.bonusValeur}>{nbCommandes}</Text>
              <Text style={st.bonusLibelle}>commandes</Text>
            </View>
            <View style={st.bonusPuce}>
              <Text style={st.bonusValeur}>{favoris.length}</Text>
              <Text style={st.bonusLibelle}>favoris</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        {/* Le statut, avec la marche suivante */}
        <View style={[st.bloc, { gap: 10 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={S.titre}>
              Ton statut : <Text style={{ color: palierActuel.couleur }}>{palierActuel.nom}</Text>
            </Text>
            <Text style={{ fontSize: 12, color: C.gris }}>{fcfa(depense)} dépensés</Text>
          </View>

          {suivant ? (
            <>
              <View style={st.jauge}>
                <View style={[st.jaugePleine, { width: `${progression * 100}%` }]} />
              </View>
              <Text style={{ fontSize: 12, color: C.gris }}>
                Encore {fcfa(suivant.seuil - depense)} pour atteindre {suivant.nom}.
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 12, color: C.gris }}>
              Tu es au palier le plus haut. Merci.
            </Text>
          )}
        </View>

        {/* Le relais — mis en avant, c'est notre spécificité */}
        <Pressable onPress={() => router.push('/relais')} style={st.relais}>
          <View style={st.relaisRond}>
            <Icone nom="relais" taille={22} couleur="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Mon relais</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              Ton code, ton chemin, ta remise
            </Text>
          </View>
          <Icone nom="suite" taille={18} couleur="rgba(255,255,255,0.6)" />
        </Pressable>

        {/* Mes achats */}
        <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
          <Ligne icone="colis" titre="Mes commandes" badge={nbCommandes}
            onPress={() => router.push('/commandes')} />
          <Ligne icone="favori" titre="Mes favoris" badge={favoris.length}
            onPress={() => router.push('/favoris')} />
          <Ligne icone="panier" titre="Mon panier" badge={nbArticles}
            onPress={() => router.push('/panier')} />
          <Ligne icone="etoile" titre="Mes avis" onPress={() => router.push('/avis')} />
        </View>

        {/* Gagner */}
        <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
          <Ligne icone="cadeau" titre="Bonus et fidélité" valeur={`${bonus.toLocaleString('fr-FR')} pts`}
            onPress={() => router.push('/fidelite')} />
          <Ligne icone="personnes" titre="Parrainage" onPress={() => router.push('/parrainage')} />
          <Ligne icone="boutique" titre="Les boutiques" onPress={() => router.push('/boutiques')} />
          <Ligne icone="live" titre="Les lives" onPress={() => router.push('/lives')} />
        </View>

        {/* Le commerçant */}
        {vendor ? (
          <Pressable onPress={() => router.push('/vendeur')} style={st.vendeur}>
            <Icone nom="boutique" taille={23} couleur={C.orange} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.encre }}>
                {vendor.shop_name}
              </Text>
              <Text style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>
                Ouvrir mon comptoir
              </Text>
            </View>
            <Icone nom="suite" taille={18} couleur={C.grisClair} />
          </Pressable>
        ) : (
          <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
            <Ligne icone="boutique" titre="Devenir vendeur" onPress={() => router.push('/devenir-vendeur')} />
          </View>
        )}

        {/* Le compte */}
        <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
          <Ligne icone="reglages" titre="Mes données" onPress={() => router.push('/compte')} />
          <Ligne icone="position" titre="Mes adresses" onPress={() => router.push('/adresses')} />
          <Ligne icone="aide" titre="Assistance" onPress={() => router.push('/aide')} />
          <Ligne icone="info" titre="À propos" onPress={() => router.push('/a-propos')} />
          <Ligne icone="sortie" titre="Se déconnecter" danger
            onPress={() => deconnecter().then(() => router.replace('/'))} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  nom: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  sousTitre: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 2 },

  bonusRangee: { flexDirection: 'row', gap: 8, marginTop: 14 },
  bonusPuce: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: R.champ,
    paddingVertical: 9, alignItems: 'center',
  },
  bonusValeur: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  bonusLibelle: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, marginTop: 1 },

  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },

  jauge: { height: 7, borderRadius: 4, backgroundColor: C.champ, overflow: 'hidden' },
  jaugePleine: { height: '100%', backgroundColor: C.orange, borderRadius: 4 },

  relaisRond: {
    width: 40, height: 40, borderRadius: R.vignette, backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  relais: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.marine, borderRadius: R.carte,
    marginHorizontal: E.page, marginBottom: 12, padding: 14,
  },
  vendeur: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.orangePale, borderRadius: R.carte,
    borderWidth: 1, borderColor: '#FFD9C0',
    marginHorizontal: E.page, marginBottom: 12, padding: 14,
  },
});
