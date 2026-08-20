import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, TextInput, Modal, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { Vide, Chargement, Puces, Champ } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';
import Icone from '../../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   MES PRODUITS

   Liste, ajout, modification, épuisé. Trois gestes suffisent, et l'un d'eux
   compte plus que les autres : marquer un article épuisé.

   Un commerçant qui ne peut pas dire « je ne l'ai plus » en deux touches
   laisse la fiche en ligne, reçoit une commande qu'il ne peut pas honorer, et
   c'est le client qui paie l'erreur. Le bouton est donc sur la ligne, pas
   caché dans un formulaire.
   ══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  'Tech Lab', 'Audio Lab', 'Femme', 'Clothing', 'Shoes', 'Beauté',
  'Accessories', 'Maison', 'Sport', 'Bébé & Enfants', 'Auto',
  'Bien-être', 'Santé', 'Nutrition', 'Alimentation', 'Restauration',
];

const VIDE = { name: '', price: '', type: 'Tech Lab', description: '', img: '' };

export default function Produits() {
  const router = useRouter();
  const { vendor } = useSession();

  const [liste, setListe] = useState(null);
  const [filtre, setFiltre] = useState('tous');
  const [q, setQ] = useState('');
  const [edite, setEdite] = useState(null);
  const [form, setForm] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    if (!vendor?.id) return;
    const { data } = await supabase.from('products')
      .select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
    setListe(data || []);
  }, [vendor?.id]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrir = (p) => {
    setEdite(p || 'nouveau');
    setForm(p ? {
      name: p.name || '', price: String(p.price || ''), type: p.type || 'Tech Lab',
      description: p.description || '', img: p.img || '',
    } : VIDE);
    setMsg('');
  };

  const enregistrer = async () => {
    if (!form.name.trim()) { setMsg('Le nom de l’article.'); return; }
    const prix = Number(String(form.price).replace(/\D/g, ''));
    if (!prix) { setMsg('Un prix, en francs.'); return; }

    setBusy(true); setMsg('');
    const patch = {
      name: form.name.trim(), price: prix, type: form.type,
      description: form.description.trim() || null,
      img: form.img.trim() || null, vendor_id: vendor.id,
    };
    const { error } = edite === 'nouveau'
      ? await supabase.from('products').insert({ ...patch, status: 'In Stock' })
      : await supabase.from('products').update(patch).eq('id', edite.id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setEdite(null); charger();
  };

  const basculerStock = async (p) => {
    await supabase.from('products')
      .update({ status: p.status === 'Épuisé' ? 'In Stock' : 'Épuisé' })
      .eq('id', p.id);
    charger();
  };

  const supprimer = async (p) => {
    await supabase.from('products').delete().eq('id', p.id);
    setEdite(null); charger();
  };

  const filtree = (liste || [])
    .filter((p) => filtre === 'tous'
      || (filtre === 'epuise' ? p.status === 'Épuisé' : p.status !== 'Épuisé'))
    .filter((p) => !q.trim() || (p.name || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Mes produits</Text>
            <Pressable onPress={() => ouvrir(null)} style={st.plus}>
              <Icone nom="plus" taille={21} couleur={C.marine} />
            </Pressable>
          </View>
          <View style={st.champ}>
            <TextInput value={q} onChangeText={setQ} placeholder="Chercher dans mes articles"
              placeholderTextColor="rgba(255,255,255,0.5)" style={st.saisie} />
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingVertical: 12 }}>
        <Puces actif={filtre} onChoisir={setFiltre} valeurs={[
          { valeur: 'tous', libelle: `Tous (${liste?.length || 0})` },
          { valeur: 'stock', libelle: 'En stock' },
          { valeur: 'epuise', libelle: 'Épuisés' },
        ]} />
      </View>

      {liste === null ? <Chargement /> : filtree.length === 0 ? (
        <Vide icone="etiquette" titre="Aucun article"
          texte="Ajoute ton premier article : nom, prix, photo. Tu pourras le compléter ensuite."
          bouton="Ajouter un article" onBouton={() => ouvrir(null)} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30, gap: 10 }}>
          {filtree.map((p) => {
            const epuise = p.status === 'Épuisé';
            return (
              <View key={p.id} style={st.ligne}>
                <Pressable onPress={() => ouvrir(p)}>
                  <Image source={{ uri: p.img }} resizeMode="contain" style={st.vignette} />
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => ouvrir(p)}>
                  <Text numberOfLines={2} style={{ fontSize: 13.5, color: C.encre, lineHeight: 17 }}>
                    {p.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: C.gris, marginTop: 2 }}>{p.type}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.encre, marginTop: 4 }}>
                    {fcfa(p.price)}
                  </Text>
                </Pressable>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <View style={[st.etat, epuise
                    ? { backgroundColor: '#FDEAEA' } : { backgroundColor: '#EAF7EF' }]}>
                    <Text style={{
                      fontSize: 10.5, fontWeight: '700',
                      color: epuise ? C.rouge : C.vert,
                    }}>{epuise ? 'Épuisé' : 'En stock'}</Text>
                  </View>
                  <Pressable onPress={() => basculerStock(p)} style={st.bascule}>
                    <Text style={{ fontSize: 11.5, color: C.encre, fontWeight: '600' }}>
                      {epuise ? 'Remettre' : 'Épuisé'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Le formulaire */}
      <Modal visible={!!edite} animationType="slide" transparent onRequestClose={() => setEdite(null)}>
        <View style={st.voile}>
          <View style={st.feuille}>
            <View style={st.poigneeZone}><View style={st.poignee} /></View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
              <Text style={S.titre}>
                {edite === 'nouveau' ? 'Nouvel article' : 'Modifier l’article'}
              </Text>

              <Champ label="Nom" value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Timberland homme 45 marron" />

              <Champ label="Prix en francs" value={form.price} keyboardType="numeric"
                onChangeText={(v) => setForm((f) => ({ ...f, price: v.replace(/\D/g, '') }))}
                placeholder="48000"
                aide="C’est le prix que le client voit et paie." />

              <View style={{ gap: 6 }}>
                <Text style={S.etiquette}>Catégorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 7 }}>
                  {CATEGORIES.map((c) => (
                    <Pressable key={c} onPress={() => setForm((f) => ({ ...f, type: c }))}
                      style={[st.cat, form.type === c && { borderColor: C.orange, backgroundColor: C.orangePale }]}>
                      <Text style={{ fontSize: 12.5, color: C.encre }}>{c}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Champ label="Adresse de la photo" value={form.img}
                onChangeText={(v) => setForm((f) => ({ ...f, img: v }))}
                placeholder="https://…" autoCapitalize="none"
                aide="Un article sans photo se vend trois fois moins." />

              <Champ label="Description" value={form.description} multiline
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Ce qu’il faut savoir avant d’acheter"
                style={[S.champ, { height: 90, textAlignVertical: 'top' }]} />

              {!!msg && <Text style={{ color: C.rouge, fontSize: 13 }}>{msg}</Text>}

              <Pressable onPress={enregistrer} disabled={busy}
                style={[S.bouton, busy && S.boutonEteint]}>
                <Text style={S.boutonTexte}>{busy ? '…' : 'Enregistrer'}</Text>
              </Pressable>

              {edite !== 'nouveau' && (
                <Pressable onPress={() => supprimer(edite)} style={{ paddingVertical: 10 }}>
                  <Text style={{ color: C.rouge, fontSize: 13.5, textAlign: 'center' }}>
                    Supprimer cet article
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={() => setEdite(null)} style={{ paddingVertical: 6 }}>
                <Text style={{ color: C.gris, fontSize: 13.5, textAlign: 'center' }}>Annuler</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { flex: 1, color: '#FFF', fontSize: 19, fontWeight: '800' },
  plus: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  champ: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: R.puce, paddingHorizontal: 14,
  },
  saisie: { fontSize: 15, color: '#FFF', paddingVertical: 10 },

  ligne: {
    flexDirection: 'row', gap: 11, backgroundColor: C.carte,
    borderRadius: R.carte, padding: 11, marginHorizontal: E.page, ...OMBRE,
  },
  vignette: { width: 62, height: 76, borderRadius: R.vignette, backgroundColor: '#FFF' },
  etat: { borderRadius: R.puce, paddingHorizontal: 9, paddingVertical: 3 },
  bascule: {
    borderWidth: 1, borderColor: C.bord, borderRadius: R.puce,
    paddingHorizontal: 11, paddingVertical: 6,
  },

  voile: { flex: 1, backgroundColor: 'rgba(20,27,77,0.45)', justifyContent: 'flex-end' },
  feuille: {
    backgroundColor: C.carte, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  poigneeZone: { alignItems: 'center', paddingVertical: 10 },
  poignee: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.grisClair },
  cat: {
    borderWidth: 1.5, borderColor: C.bord, borderRadius: R.puce,
    paddingHorizontal: 13, paddingVertical: 7,
  },
});
