import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { C, S } from '../lib/theme';

/* ══════════════════════════════════════════════════════════════════════════
   SE CONNECTER

   Deux portes, comme sur le web. Celui qui s'est inscrit au comptoir a un
   compte dérivé de son numéro ; celui qui s'est inscrit sur le site a une
   vraie adresse. On accepte les deux dans le même champ plutôt que de lui
   demander de se souvenir laquelle — beaucoup ne le savent plus, et on ne
   fait pas réfléchir quelqu'un qui veut juste ouvrir son comptoir.
   ══════════════════════════════════════════════════════════════════════════ */

export default function Connexion() {
  const router = useRouter();
  const [identifiant, setId] = useState('');
  const [mdp, setMdp] = useState('');
  const [inscription, setInscription] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Un identifiant fait uniquement de chiffres est un numéro : on lui redonne
  // la forme dérivée que le comptoir a créée.
  const resoudre = (saisi) => {
    const s = saisi.trim();
    const chiffres = s.replace(/\D/g, '');
    return /^\d{9,}$/.test(chiffres) && !s.includes('@')
      ? `${chiffres}@relais.buyticle.cm`
      : s;
  };

  const valider = async () => {
    if (!identifiant.trim() || mdp.length < 6) {
      setMsg('Ton identifiant, et six caractères au minimum.');
      return;
    }
    setBusy(true); setMsg('');
    const email = resoudre(identifiant);

    const { error } = inscription
      ? await supabase.auth.signUp({ email, password: mdp })
      : await supabase.auth.signInWithPassword({ email, password: mdp });

    setBusy(false);
    if (error) {
      setMsg(inscription
        ? 'Ce compte existe déjà. Connecte-toi.'
        : 'Identifiant ou mot de passe incorrect.');
      return;
    }
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[S.carte, { gap: 12 }]}>
          <View>
            <Text style={S.titre}>
              {inscription ? 'Créer ton compte' : 'Ouvre ton comptoir'}
            </Text>
            <Text style={[S.sousTitre, { marginTop: 4 }]}>
              Ton numéro ou ton adresse e-mail — l’un ou l’autre, celui avec
              lequel tu t’es inscrit.
            </Text>
          </View>

          <View>
            <Text style={S.etiquette}>Numéro ou e-mail</Text>
            <TextInput
              value={identifiant} onChangeText={setId}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              placeholder="6XX XX XX XX ou toi@exemple.com"
              placeholderTextColor="#9AA0A6"
              style={[S.champ, { marginTop: 6 }]} />
          </View>

          <View>
            <Text style={S.etiquette}>Mot de passe</Text>
            <TextInput
              value={mdp} onChangeText={setMdp}
              secureTextEntry placeholder="••••••"
              placeholderTextColor="#9AA0A6"
              style={[S.champ, { marginTop: 6 }]} />
          </View>

          <Pressable onPress={valider} disabled={busy}
            style={[S.bouton, busy && { opacity: 0.4 }]}>
            <Text style={S.boutonTexte}>
              {busy ? '…' : inscription ? 'Créer mon compte' : 'Se connecter'}
            </Text>
          </Pressable>

          {!!msg && (
            <Text style={{ color: C.prix, fontSize: 13, textAlign: 'center' }}>{msg}</Text>
          )}

          <Pressable onPress={() => { setInscription(!inscription); setMsg(''); }}>
            <Text style={{ color: C.lien, fontSize: 13, textAlign: 'center', paddingVertical: 6 }}>
              {inscription ? 'J’ai déjà un compte' : 'Je n’ai pas encore de compte'}
            </Text>
          </Pressable>
        </View>

        <Text style={[S.sousTitre, { textAlign: 'center', paddingHorizontal: 12 }]}>
          Ton numéro sert à retrouver ton compte. Il est vérifié au moment du
          paiement, pas maintenant.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
