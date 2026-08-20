import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Barre, Champ, Vide } from '../components/Base';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from '../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   MES ADRESSES

   À Douala, une adresse n'est pas une rue et un numéro : c'est un quartier et
   un repère. « Bonamoussadi, derrière la pharmacie du Rond-Point » vaut mieux
   que n'importe quelle voie nommée, et c'est ce que le livreur demandera au
   téléphone de toute façon. Le champ « repère » n'est donc pas un extra : il
   est le plus utile de la fiche, et c'est pour ça qu'il porte un exemple.

   Une seule adresse est « par défaut ». La basculer met les autres à faux
   dans la foulée — deux adresses par défaut et le panier en choisit une au
   hasard, ce qui se voit le jour de la livraison, pas avant.
   ══════════════════════════════════════════════════════════════════════════ */

const VIDE = {
  label: 'Maison', full_name: '', phone: '', city: 'Douala',
  neighborhood: '', street: '', extra: '', is_default: false,
};

const ETIQUETTES = ['Maison', 'Bureau', 'Chez un proche', 'Autre'];

export default function Adresses() {
  const router = useRouter();
  const { user } = useSession();

  const [liste, setListe] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('user_addresses').select('*')
      .eq('user_id', user.id).order('is_default', { ascending: false });
    setListe(data || []);
  }, [user]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrir = (a) => {
    setErreur('');
    setF(a ? { ...a } : { ...VIDE, full_name: '', phone: '' });
    setOuvert(true);
  };

  const enregistrer = async () => {
    if (!f.neighborhood?.trim() && !f.street?.trim()) {
      setErreur('Il faut au moins le quartier ou la rue.');
      return;
    }
    if (!f.phone?.trim()) {
      setErreur('Le numéro est indispensable — le livreur appelle toujours.');
      return;
    }
    setBusy(true);
    const corps = {
      label: f.label, full_name: f.full_name?.trim() || null, phone: f.phone.trim(),
      city: f.city || 'Douala', neighborhood: f.neighborhood?.trim() || null,
      street: f.street?.trim() || null, extra: f.extra?.trim() || null,
      is_default: !!f.is_default,
    };

    const { data, error } = f.id
      ? await supabase.from('user_addresses').update(corps).eq('id', f.id).select().maybeSingle()
      : await supabase.from('user_addresses').insert({ user_id: user.id, ...corps }).select().maybeSingle();

    // La mise à faux des autres vient APRÈS, et seulement si l'écriture a
    // réussi : l'inverse laisserait le compte sans aucune adresse par défaut.
    if (!error && data?.is_default) {
      await supabase.from('user_addresses').update({ is_default: false })
        .eq('user_id', user.id).neq('id', data.id);
    }

    setBusy(false);
    if (error) { setErreur("Ça n’a pas été enregistré. Réessaie."); return; }
    setOuvert(false);
    charger();
  };

  const supprimer = async (a) => {
    await supabase.from('user_addresses').delete().eq('id', a.id);
    charger();
  };

  const parDefaut = async (a) => {
    await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('user_addresses').update({ is_default: true }).eq('id', a.id);
    charger();
  };

  if (!user) {
    return (
      <View style={S.page}>
        <Barre titre="Mes adresses" />
        <Vide icone="position" titre="Connecte-toi"
          texte="Tes adresses sont rattachées à ton compte."
          bouton="Se connecter" onBouton={() => router.push('/connexion')} />
      </View>
    );
  }

  return (
    <View style={S.page}>
      <Barre titre="Mes adresses"
        action={
          <Pressable hitSlop={8} onPress={() => ouvrir(null)}>
            <Icone nom="plus" taille={24} couleur="#FFF" />
          </Pressable>
        } />

      {liste === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.marine} />
      ) : liste.length === 0 ? (
        <Vide icone="position" titre="Aucune adresse"
          texte="Ajoute-en une : elle sera proposée à chaque commande, et tu n’auras plus à la réécrire."
          bouton="Ajouter une adresse" onBouton={() => ouvrir(null)} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: E.page, paddingBottom: 40, gap: 10 }}>
          {liste.map((a) => (
            <View key={a.id} style={st.carte}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icone nom="position" taille={17} couleur={C.orange} />
                <Text style={st.label}>{a.label || 'Adresse'}</Text>
                {a.is_default && (
                  <View style={st.defaut}><Text style={st.defautTexte}>Par défaut</Text></View>
                )}
              </View>

              <Text style={st.ligne}>
                {[a.neighborhood, a.street].filter(Boolean).join(', ')}
                {a.city ? ` — ${a.city}` : ''}
              </Text>
              {!!a.extra && <Text style={st.repere}>{a.extra}</Text>}
              <Text style={st.tel}>{[a.full_name, a.phone].filter(Boolean).join(' · ')}</Text>

              <View style={st.actions}>
                {!a.is_default && (
                  <Pressable onPress={() => parDefaut(a)} style={st.action}>
                    <Text style={st.actionTexte}>En faire la principale</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => ouvrir(a)} style={st.action}>
                  <Text style={st.actionTexte}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => supprimer(a)} style={st.action}>
                  <Text style={[st.actionTexte, { color: C.rouge }]}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={ouvert} animationType="slide" transparent
        onRequestClose={() => setOuvert(false)}>
        <View style={st.voile}>
          <View style={st.feuille}>
            <View style={st.poignee} />
            <Text style={st.feuilleTitre}>
              {f.id ? 'Modifier l’adresse' : 'Nouvelle adresse'}
            </Text>

            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
              <View>
                <Text style={S.etiquette}>Étiquette</Text>
                <View style={st.puces}>
                  {ETIQUETTES.map((e) => (
                    <Pressable key={e} onPress={() => setF({ ...f, label: e })}
                      style={[st.puce, f.label === e && st.puceActive]}>
                      <Text style={[st.puceTexte, f.label === e && { color: '#FFF' }]}>{e}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Champ label="Quartier" value={f.neighborhood}
                onChangeText={(v) => setF({ ...f, neighborhood: v })}
                placeholder="Bonamoussadi, Akwa, Bonapriso…" />

              <Champ label="Rue ou immeuble" value={f.street}
                onChangeText={(v) => setF({ ...f, street: v })}
                placeholder="Facultatif" />

              <Champ label="Le repère" value={f.extra}
                onChangeText={(v) => setF({ ...f, extra: v })}
                placeholder="Derrière la pharmacie du Rond-Point"
                aide="C’est ce que le livreur demandera au téléphone. Autant l’écrire une fois." />

              <Champ label="Ville" value={f.city}
                onChangeText={(v) => setF({ ...f, city: v })} placeholder="Douala" />

              <Champ label="Qui reçoit" value={f.full_name}
                onChangeText={(v) => setF({ ...f, full_name: v })}
                placeholder="Ton nom, ou celui d’un proche" />

              <Champ label="Numéro à appeler" value={f.phone}
                onChangeText={(v) => setF({ ...f, phone: v })}
                keyboardType="phone-pad" placeholder="6XX XX XX XX" />

              <Pressable onPress={() => setF({ ...f, is_default: !f.is_default })}
                style={st.case}>
                <View style={[st.carre, f.is_default && st.carrePlein]}>
                  {f.is_default && <Icone nom="coche" taille={13} couleur="#FFF" />}
                </View>
                <Text style={{ fontSize: 13.5, color: C.encre, flex: 1 }}>
                  En faire mon adresse principale
                </Text>
              </Pressable>

              {!!erreur && <Text style={{ color: C.rouge, fontSize: 13 }}>{erreur}</Text>}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setOuvert(false)} style={[S.boutonFin, { flex: 1 }]}>
                <Text style={S.boutonFinTexte}>Annuler</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={enregistrer}
                style={[S.bouton, { flex: 1.4 }, busy && S.boutonEteint]}>
                <Text style={[S.boutonTexte, busy && S.boutonEteintTexte]}>
                  {busy ? 'Un instant…' : 'Enregistrer'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 14, gap: 4, ...OMBRE },
  label: { fontSize: 14.5, fontWeight: '700', color: C.encre },
  defaut: {
    backgroundColor: C.orangePale, borderRadius: R.puce,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  defautTexte: { fontSize: 10, fontWeight: '700', color: C.orange },
  ligne: { fontSize: 13.5, color: C.encre, marginTop: 3 },
  repere: { fontSize: 12.5, color: C.gris, fontStyle: 'italic' },
  tel: { fontSize: 12.5, color: C.gris, marginTop: 2 },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14,
    marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: C.bord,
  },
  action: {},
  actionTexte: { fontSize: 12.5, fontWeight: '600', color: C.marine },

  voile: { flex: 1, backgroundColor: 'rgba(20,27,77,0.4)', justifyContent: 'flex-end' },
  feuille: {
    backgroundColor: C.carte, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: E.page, paddingTop: 10, maxHeight: '92%', gap: 12,
  },
  poignee: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.bord, alignSelf: 'center',
  },
  feuilleTitre: { fontSize: 17, fontWeight: '800', color: C.encre },

  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6 },
  puce: {
    borderWidth: 1, borderColor: C.bord, borderRadius: R.puce,
    paddingHorizontal: 13, paddingVertical: 7, backgroundColor: C.champ,
  },
  puceActive: { backgroundColor: C.marine, borderColor: C.marine },
  puceTexte: { fontSize: 13, color: C.encre },

  case: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  carre: {
    width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: C.grisClair,
    alignItems: 'center', justifyContent: 'center',
  },
  carrePlein: { backgroundColor: C.marine, borderColor: C.marine },
});
