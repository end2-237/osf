import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Barre, Champ, Vide } from '../components/Base';
import { C, R, S, E, OMBRE } from '../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   MES DONNÉES

   Un formulaire, pas un tableau de bord. Six champs et un bouton.

   Le téléphone est en lecture seule : il sert d'identifiant de connexion et
   le changer ici couperait le compte de son propriétaire sans qu'il le
   comprenne. On dit pourquoi plutôt que de griser en silence — un champ grisé
   sans explication fait croire à une panne.
   ══════════════════════════════════════════════════════════════════════════ */

const VILLES = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bamenda', 'Kribi'];

export default function Compte() {
  const router = useRouter();
  const { user } = useSession();

  const [profil, setProfil] = useState(null);
  const [f, setF] = useState({ full_name: '', city: 'Douala', bio: '', birthday: '', gender: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        setProfil(data || {});
        setF({
          full_name: data?.full_name || '',
          city: data?.city || 'Douala',
          bio: data?.bio || '',
          birthday: data?.birthday || '',
          gender: data?.gender || '',
        });
      });
  }, [user]);

  const enregistrer = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('profiles')
      .update({
        full_name: f.full_name.trim() || null,
        city: f.city || null,
        bio: f.bio.trim() || null,
        // Une date vide doit partir en NULL : la chaîne vide fait échouer la
        // colonne `date` côté Postgres, avec un message que personne ne lit.
        birthday: f.birthday.trim() || null,
        gender: f.gender || null,
      })
      .eq('id', user.id);
    setBusy(false);
    setMsg(error
      ? { t: 'ko', m: "Ça n’a pas été enregistré. Réessaie dans un moment." }
      : { t: 'ok', m: 'C’est enregistré.' });
  };

  if (!user) {
    return (
      <View style={S.page}>
        <Barre titre="Mes données" />
        <Vide icone="profil" titre="Connecte-toi"
          texte="Tes données t’attendent une fois connecté."
          bouton="Se connecter" onBouton={() => router.push('/connexion')} />
      </View>
    );
  }

  return (
    <View style={S.page}>
      <Barre titre="Mes données" />
      {profil === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.marine} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: E.page, paddingBottom: 40, gap: 12 }}>
          <View style={st.bloc}>
            <Champ label="Nom complet" value={f.full_name}
              onChangeText={(v) => setF({ ...f, full_name: v })}
              placeholder="Comme sur ta pièce d’identité" />

            <View style={{ marginTop: 12 }}>
              <Text style={S.etiquette}>Ville</Text>
              <View style={st.villes}>
                {VILLES.map((v) => (
                  <Pressable key={v} onPress={() => setF({ ...f, city: v })}
                    style={[st.ville, f.city === v && st.villeActive]}>
                    <Text style={[st.villeTexte, f.city === v && { color: '#FFF' }]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={S.etiquette}>Je suis</Text>
              <View style={st.villes}>
                {[['F', 'Une femme'], ['M', 'Un homme'], ['', 'Je préfère ne pas dire']].map(([k, l]) => (
                  <Pressable key={l} onPress={() => setF({ ...f, gender: k })}
                    style={[st.ville, f.gender === k && st.villeActive]}>
                    <Text style={[st.villeTexte, f.gender === k && { color: '#FFF' }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Champ label="Date de naissance" value={f.birthday}
                onChangeText={(v) => setF({ ...f, birthday: v })}
                placeholder="1995-04-20"
                aide="Format année-mois-jour. On s’en sert pour les offres d’anniversaire." />
            </View>

            <View style={{ marginTop: 12 }}>
              <Champ label="Quelques mots sur toi" value={f.bio}
                onChangeText={(v) => setF({ ...f, bio: v })} multiline
                placeholder="Facultatif" />
            </View>
          </View>

          <View style={st.bloc}>
            <Text style={S.etiquette}>Connexion</Text>
            <Text style={st.fixe}>{profil?.phone || user.email}</Text>
            <Text style={st.aide}>
              C’est avec ça que tu te connectes. Pour en changer, passe par
              l’assistance : le modifier ici couperait ton compte de toi.
            </Text>
          </View>

          {!!msg && (
            <Text style={[st.msg, msg.t === 'ok' ? { color: C.vert } : { color: C.rouge }]}>
              {msg.m}
            </Text>
          )}

          <Pressable disabled={busy} onPress={enregistrer}
            style={[S.bouton, busy && S.boutonEteint]}>
            <Text style={[S.boutonTexte, busy && S.boutonEteintTexte]}>
              {busy ? 'Un instant…' : 'Enregistrer'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  bloc: { backgroundColor: C.carte, borderRadius: R.carte, padding: 14, ...OMBRE },
  villes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  ville: {
    borderWidth: 1, borderColor: C.bord, borderRadius: R.puce,
    paddingHorizontal: 13, paddingVertical: 7, backgroundColor: C.champ,
  },
  villeActive: { backgroundColor: C.marine, borderColor: C.marine },
  villeTexte: { fontSize: 13, color: C.encre },
  fixe: { fontSize: 15, fontWeight: '600', color: C.encre, marginTop: 5 },
  aide: { fontSize: 11.5, color: C.gris, lineHeight: 16, marginTop: 5 },
  msg: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
