import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Barre, Champ, Vide } from '../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../lib/ui';
import Icone from '../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   DEVENIR VENDEUR

   La demande, pas la boutique. Ce qu'on écrit ici part en `pending` et un
   humain le lit — c'est ce qui empêche la place de se remplir de comptes
   fantômes, et c'est aussi pour ça qu'on annonce le délai.

   Les pièces d'identité restent sur le site : téléverser une photo de CNI
   depuis un téléphone demande la caméra, le stockage et un consentement, et
   l'on ne bricole pas ça dans un formulaire. On récolte ici ce qui ne coûte
   rien à donner, et l'on renvoie vers le site pour la pièce — en le disant.

   Si une demande existe déjà, on ne montre PAS le formulaire : on montre où
   elle en est. Un deuxième envoi ne fait pas avancer un dossier, il en crée
   un doublon que quelqu'un devra trancher à la main.
   ══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  'Tech et téléphonie', 'Mode et prêt-à-porter', 'Chaussures', 'Beauté et soins',
  'Maison et cuisine', 'Alimentation', 'Quincaillerie', 'Sport', 'Autre',
];

const FORFAITS = [
  { cle: 'starter', nom: 'Starter', prix: 0, dit: 'Pour commencer. Commission sur les ventes uniquement.' },
  { cle: 'pro', nom: 'Pro', prix: 15000, dit: 'Boutique mise en avant, statistiques, relais illimité.' },
];

const ETATS = {
  pending: { t: 'En cours d’examen', c: C.orange, d: 'Un membre de l’équipe la lit. Compte deux jours ouvrés.' },
  approved: { t: 'Acceptée', c: C.vert, d: 'Ta boutique est ouverte. Reconnecte-toi pour y accéder.' },
  rejected: { t: 'Refusée', c: C.rouge, d: 'Passe par l’assistance : on t’expliquera ce qui manquait.' },
};

export default function DevenirVendeur() {
  const router = useRouter();
  const { user, vendor } = useSession();

  const [demande, setDemande] = useState(undefined);
  const [f, setF] = useState({
    shop_name: '', full_name: '', phone: '', city: 'Douala',
    category: CATEGORIES[0], description: '', plan: 'starter',
  });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!user) { setDemande(null); return; }
    (async () => {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from('vendor_applications').select('*')
          .eq('user_id', user.id).order('submitted_at', { ascending: false }).limit(1),
        supabase.from('profiles').select('full_name, phone, city').eq('id', user.id).maybeSingle(),
      ]);
      setDemande(d?.[0] || null);
      if (p) setF((x) => ({
        ...x,
        full_name: p.full_name || '', phone: p.phone || '', city: p.city || 'Douala',
      }));
    })();
  }, [user]);

  const envoyer = async () => {
    if (!f.shop_name.trim()) { setErreur('Il faut un nom de boutique.'); return; }
    if (!f.phone.trim()) { setErreur('Le numéro est indispensable — c’est par là qu’on te rappelle.'); return; }
    setBusy(true); setErreur('');
    const { error } = await supabase.from('vendor_applications').insert({
      user_id: user.id,
      shop_name: f.shop_name.trim(), full_name: f.full_name.trim() || null,
      phone: f.phone.trim(), city: f.city, category: f.category,
      description: f.description.trim() || null, plan: f.plan,
      status: 'pending', submitted_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) { setErreur("L’envoi a échoué. Réessaie dans un moment."); return; }
    setDemande({ status: 'pending', shop_name: f.shop_name, submitted_at: new Date().toISOString() });
  };

  if (!user) {
    return (
      <View style={S.page}>
        <Barre titre="Devenir vendeur" />
        <Vide icone="boutique" titre="Connecte-toi d’abord"
          texte="Une boutique se rattache à un compte. Crée le tien, ça prend une minute."
          bouton="Se connecter" onBouton={() => router.push('/connexion')} />
      </View>
    );
  }

  if (vendor) {
    return (
      <View style={S.page}>
        <Barre titre="Devenir vendeur" />
        <Vide icone="boutique" titre="Tu as déjà une boutique"
          texte={`${vendor.shop_name} est ouverte. Tout se pilote depuis ton comptoir.`}
          bouton="Ouvrir mon comptoir" onBouton={() => router.replace('/vendeur')} />
      </View>
    );
  }

  if (demande === undefined) {
    return (
      <View style={S.page}>
        <Barre titre="Devenir vendeur" />
        <ActivityIndicator style={{ marginTop: 40 }} color={C.marine} />
      </View>
    );
  }

  if (demande) {
    const e = ETATS[demande.status] || ETATS.pending;
    return (
      <View style={S.page}>
        <Barre titre="Ma demande" />
        <ScrollView contentContainerStyle={{ padding: E.page, gap: 12 }}>
          <View style={st.bloc}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <View style={[st.pastille, { backgroundColor: e.c }]} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: e.c }}>{e.t}</Text>
            </View>
            <Text style={{ fontSize: 13, color: C.encre, marginTop: 8, lineHeight: 19 }}>{e.d}</Text>
            <Text style={{ fontSize: 12.5, color: C.gris, marginTop: 10 }}>
              Boutique demandée : {demande.shop_name}
            </Text>
            {!!demande.submitted_at && (
              <Text style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>
                Envoyée le {new Date(demande.submitted_at).toLocaleDateString('fr-FR',
                  { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            )}
          </View>

          <Pressable onPress={() => router.push('/aide')} style={[S.boutonFin]}>
            <Text style={S.boutonFinTexte}>Poser une question à l’assistance</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={S.page}>
      <Barre titre="Devenir vendeur" />
      <ScrollView contentContainerStyle={{ padding: E.page, paddingBottom: 40, gap: 12 }}>

        <View style={[st.bloc, { backgroundColor: C.marine }]}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFF' }}>
            Vends ce que tu as déjà en boutique
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, lineHeight: 19 }}>
            Et quand tu n’as pas ce qu’on te demande, tu envoies le client chez
            un voisin qui l’a — et tu gagnes dessus. C’est le relais, et
            personne d’autre ne le fait ici.
          </Text>
        </View>

        <View style={st.bloc}>
          <Champ label="Nom de la boutique" value={f.shop_name}
            onChangeText={(v) => setF({ ...f, shop_name: v })}
            placeholder="Quincaillerie Belle Vue" />

          <View style={{ marginTop: 12 }}>
            <Champ label="Ton nom" value={f.full_name}
              onChangeText={(v) => setF({ ...f, full_name: v })}
              placeholder="Comme sur ta pièce d’identité" />
          </View>

          <View style={{ marginTop: 12 }}>
            <Champ label="Numéro à rappeler" value={f.phone}
              onChangeText={(v) => setF({ ...f, phone: v })}
              keyboardType="phone-pad" placeholder="6XX XX XX XX" />
          </View>

          <View style={{ marginTop: 12 }}>
            <Champ label="Ville" value={f.city}
              onChangeText={(v) => setF({ ...f, city: v })} placeholder="Douala" />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={S.etiquette}>Ce que tu vends</Text>
            <View style={st.puces}>
              {CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => setF({ ...f, category: c })}
                  style={[st.puce, f.category === c && st.puceActive]}>
                  <Text style={[st.puceTexte, f.category === c && { color: '#FFF' }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Champ label="En deux lignes" value={f.description}
              onChangeText={(v) => setF({ ...f, description: v })} multiline
              placeholder="Ce que tu tiens, depuis combien de temps, où exactement."
              aide="C’est ce que lira la personne qui examine ta demande." />
          </View>
        </View>

        <View style={[st.bloc, { gap: 9 }]}>
          <Text style={S.titre}>Le forfait</Text>
          {FORFAITS.map((p) => (
            <Pressable key={p.cle} onPress={() => setF({ ...f, plan: p.cle })}
              style={[st.forfait, f.plan === p.cle && st.forfaitActif]}>
              <View style={[st.rond, f.plan === p.cle && st.rondPlein]}>
                {f.plan === p.cle && <View style={st.point} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.encre }}>
                  {p.nom} · {p.prix ? `${fcfa(p.prix)} / mois` : 'gratuit'}
                </Text>
                <Text style={{ fontSize: 12, color: C.gris, marginTop: 2, lineHeight: 17 }}>
                  {p.dit}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text style={{ fontSize: 11.5, color: C.gris, lineHeight: 16 }}>
            Tu peux changer de forfait plus tard depuis ton comptoir. Rien
            n’est prélevé tant que la demande n’est pas acceptée.
          </Text>
        </View>

        <View style={[st.bloc, { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }]}>
          <Icone nom="info" taille={18} couleur={C.orange} />
          <Text style={{ flex: 1, fontSize: 12.5, color: C.encre, lineHeight: 18 }}>
            La pièce d’identité se dépose sur le site, depuis un ordinateur ou
            le navigateur du téléphone. On te dira où au moment de valider —
            elle n’est demandée qu’une seule fois.
          </Text>
        </View>

        {!!erreur && <Text style={{ color: C.rouge, fontSize: 13 }}>{erreur}</Text>}

        <Pressable disabled={busy} onPress={envoyer}
          style={[S.bouton, busy && S.boutonEteint]}>
          <Text style={[S.boutonTexte, busy && S.boutonEteintTexte]}>
            {busy ? 'Envoi…' : 'Envoyer ma demande'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  bloc: { backgroundColor: C.carte, borderRadius: R.carte, padding: 14, ...OMBRE },
  pastille: { width: 10, height: 10, borderRadius: 5 },

  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  puce: {
    borderWidth: 1, borderColor: C.bord, borderRadius: R.puce,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.champ,
  },
  puceActive: { backgroundColor: C.marine, borderColor: C.marine },
  puceTexte: { fontSize: 12.5, color: C.encre },

  forfait: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    borderWidth: 1, borderColor: C.bord, borderRadius: R.champ, padding: 12,
  },
  forfaitActif: { borderColor: C.orange, backgroundColor: C.orangePale },
  rond: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.grisClair,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  rondPlein: { borderColor: C.orange },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.orange },
});
