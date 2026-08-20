import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useBoutique } from '../lib/boutique';
import { Champ, Vide } from '../components/Base';
import { OPERATEURS, numeroMonetbil, pousserUssd, etatCommandes } from '../lib/relais';
import { C, R, S, E, OMBRE, fcfa } from '../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   LA COMMANDE

   Trois pas, jamais plus : à qui, comment, avec quoi. Un tunnel à cinq écrans
   perd la moitié des gens entre le deuxième et le troisième.

   Le paiement suit exactement le circuit du site : commande en
   `pending_payment`, poussée USSD par `monetbil-init`, et c'est le webhook de
   l'opérateur qui déclare le paiement. L'écran ne décide jamais qu'un
   paiement a eu lieu — il attend et il regarde. Le client valide sur
   l'interface de son opérateur, souvent en quittant l'application ; la
   commande doit avancer même s'il ne revient pas.

   Le paiement à la livraison reste offert : c'est encore la moitié des
   commandes, et le retirer coûterait plus que la fraude qu'il évite.
   ══════════════════════════════════════════════════════════════════════════ */

const RECEPTIONS = [
  { cle: 'express', icone: '🚀', titre: 'Livraison express', sous: 'Aujourd’hui, en 2 h', frais: 2500 },
  { cle: 'standard', icone: '🚚', titre: 'Livraison standard', sous: 'Demain', frais: 1500 },
  { cle: 'comptoir', icone: '🏪', titre: 'Retrait en boutique', sous: 'Dès aujourd’hui', frais: 0 },
];

export default function Commande() {
  const router = useRouter();
  const { user } = useSession();
  const { retenus, sousTotal, viderPanier } = useBoutique();

  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [quartier, setQuartier] = useState('');
  const [rue, setRue] = useState('');
  const [precision, setPrecision] = useState('');

  const [reception, setReception] = useState('standard');
  const [moyen, setMoyen] = useState('orange_money');
  const [telPaie, setTelPaie] = useState('');

  const [phase, setPhase] = useState('saisie');   // saisie · attente · fini
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ids, setIds] = useState([]);
  const minuteur = useRef(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setNom((n) => n || data.full_name || '');
        setTel((t) => t || data.phone || '');
        setTelPaie((t) => t || data.phone || '');
      });
  }, [user]);

  const frais = RECEPTIONS.find((r) => r.cle === reception)?.frais || 0;
  const total = sousTotal + frais;

  // On attend le webhook, pas le client.
  useEffect(() => {
    if (phase !== 'attente' || !ids.length) return;
    const debut = Date.now();
    minuteur.current = setInterval(async () => {
      if (Date.now() - debut > 8 * 60 * 1000) {
        clearInterval(minuteur.current);
        setPhase('saisie');
        setMsg('Délai dépassé. Ta commande t’attend dans « Mes commandes ».');
        return;
      }
      const { data } = await etatCommandes(ids);
      const etats = (data || []).map((o) => o.status);
      if (etats.length && etats.every((e) => e === 'paid')) {
        clearInterval(minuteur.current);
        viderPanier();
        setPhase('fini');
      } else if (etats.some((e) => e === 'payment_failed' || e === 'cancelled')) {
        clearInterval(minuteur.current);
        setPhase('saisie');
        setMsg('Paiement refusé ou annulé. Vérifie ton solde et réessaie.');
      }
    }, 5000);
    return () => clearInterval(minuteur.current);
  }, [phase, ids]);   // eslint-disable-line react-hooks/exhaustive-deps

  const adresse = () => reception === 'comptoir'
    ? 'Retrait en boutique'
    : [quartier, rue, precision].filter(Boolean).join(', ');

  const valider = async (enLigne) => {
    if (!nom.trim() || tel.replace(/\D/g, '').length < 9) {
      setMsg('Ton nom et ton numéro, pour qu’on puisse te joindre.'); return;
    }
    if (reception !== 'comptoir' && !quartier.trim()) {
      setMsg('Ton quartier, au minimum — le livreur en a besoin.'); return;
    }
    if (enLigne && numeroMonetbil(telPaie).length < 11) {
      setMsg('Le numéro qui paie, à 9 chiffres.'); return;
    }

    setBusy(true); setMsg('');

    // Une commande par boutique : chaque commerçant ne voit et n'encaisse que
    // la sienne. Un panier mixte qui ferait une seule commande obligerait à
    // répartir l'argent après coup, et c'est là que tout se perd.
    const parBoutique = {};
    for (const a of retenus) {
      const v = a.vendor_id || 'sans';
      (parBoutique[v] ||= []).push(a);
    }

    const cree = [];
    try {
      for (const [vid, lignes] of Object.entries(parBoutique)) {
        const montant = lignes.reduce((s, x) => s + x.price * (x.quantite || 1), 0);
        const { data: o, error } = await supabase.from('orders').insert({
          user_id: user.id,
          vendor_id: vid === 'sans' ? null : vid,
          client_name: nom.trim(),
          client_phone: tel.replace(/\D/g, ''),
          client_address: adresse(),
          total_amount: montant,
          delivery_fee: vid === Object.keys(parBoutique)[0] ? frais : 0,
          payment_method: enLigne ? moyen : 'cash_on_delivery',
          status: enLigne ? 'pending_payment' : 'pending',
          fulfilment: reception === 'comptoir' ? 'comptoir' : 'livraison',
        }).select().single();
        if (error) throw new Error(error.message);

        await supabase.from('order_items').insert(lignes.map((x) => ({
          order_id: o.id, product_id: x.id, product_name: x.name,
          product_img: x.img, quantity: x.quantite || 1, unit_price: x.price,
          selected_size: x.taille || null, selected_color: x.couleur || null,
        })));
        cree.push(o.id);
      }

      if (!enLigne) { viderPanier(); setPhase('fini'); setBusy(false); return; }

      await pousserUssd({ orderId: cree[0], montant: total, tel: telPaie, moyen });
      setIds(cree);
      setPhase('attente');
    } catch (e) {
      setMsg(e.message || 'La commande n’a pas pu être créée.');
    } finally { setBusy(false); }
  };

  if (!user) {
    return <Vide icone="👤" titre="Connecte-toi pour commander"
      bouton="Se connecter" onBouton={() => router.push('/connexion')} />;
  }

  if (phase === 'fini') {
    return (
      <View style={S.page}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
          <View style={st.enTete}><Text style={st.titre}>Commande envoyée</Text></View>
        </SafeAreaView>
        <Vide icone="✅" titre="C’est parti"
          texte={reception === 'comptoir'
            ? 'La boutique prépare ta commande. Tu recevras une notification quand elle sera prête à retirer.'
            : 'La boutique prépare ta commande. Tu suivras la livraison depuis « Mes commandes ».'}
          bouton="Suivre ma commande" onBouton={() => router.replace('/commandes')} />
      </View>
    );
  }

  if (phase === 'attente') {
    return (
      <View style={S.page}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
          <View style={st.enTete}><Text style={st.titre}>Paiement en cours</Text></View>
        </SafeAreaView>
        <View style={[st.bloc, { alignItems: 'center', gap: 12, marginTop: 24 }]}>
          <ActivityIndicator color={C.marine} />
          <Text style={[S.titre, { textAlign: 'center' }]}>
            Compose le code sur ton téléphone
          </Text>
          <Text style={[S.sousTitre, { textAlign: 'center' }]}>
            Un message vient d’arriver sur le {telPaie}. Valide-le avec ton code
            secret {OPERATEURS.find(([k]) => k === moyen)?.[1]}. Cet écran se met
            à jour tout seul.
          </Text>
          <Pressable onPress={() => { clearInterval(minuteur.current); setPhase('saisie'); }}>
            <Text style={{ color: C.gris, fontSize: 13, paddingVertical: 8 }}>Ça ne marche pas</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Text style={{ color: '#FFF', fontSize: 24 }}>‹</Text>
            </Pressable>
            <Text style={st.titre}>Ma commande</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 130 }}>
        {/* ① À qui */}
        <View style={[st.bloc, { gap: 12 }]}>
          <Text style={S.titre}>① À qui on livre</Text>
          <Champ label="Nom complet" value={nom} onChangeText={setNom} placeholder="Ton nom" />
          <Champ label="Téléphone" value={tel} onChangeText={setTel}
            keyboardType="numeric" placeholder="6XX XX XX XX"
            aide="C’est le numéro que le livreur appellera." />
        </View>

        {/* ② Comment */}
        <View style={[st.bloc, { gap: 10 }]}>
          <Text style={S.titre}>② Comment tu la reçois</Text>
          {RECEPTIONS.map((r) => (
            <Pressable key={r.cle} onPress={() => setReception(r.cle)}
              style={[st.option, reception === r.cle && st.optionChoisie]}>
              <Text style={{ fontSize: 19 }}>{r.icone}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.encre }}>{r.titre}</Text>
                <Text style={{ fontSize: 11.5, color: C.gris }}>{r.sous}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: r.frais ? C.encre : C.vert }}>
                {r.frais ? fcfa(r.frais) : 'Gratuit'}
              </Text>
            </Pressable>
          ))}

          {reception !== 'comptoir' && (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Champ label="Quartier" value={quartier} onChangeText={setQuartier}
                placeholder="Akwa, Bonapriso, Deido…" />
              <Champ label="Rue ou repère" value={rue} onChangeText={setRue}
                placeholder="Rue Joss, face à la pharmacie" />
              <Champ label="Précision (facultatif)" value={precision} onChangeText={setPrecision}
                placeholder="Immeuble bleu, 2ᵉ étage" />
            </View>
          )}
        </View>

        {/* ③ Avec quoi */}
        <View style={[st.bloc, { gap: 10 }]}>
          <Text style={S.titre}>③ Comment tu paies</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {OPERATEURS.map(([cle, nomOp]) => (
              <Pressable key={cle} onPress={() => setMoyen(cle)}
                style={[st.moyen, moyen === cle && st.optionChoisie]}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.encre }}>{nomOp}</Text>
              </Pressable>
            ))}
          </View>
          <Champ label="Numéro qui paie" value={telPaie} onChangeText={setTelPaie}
            keyboardType="numeric" placeholder="6XX XX XX XX"
            aide="Tu recevras un message à valider avec ton code secret." />
        </View>

        {/* Le récapitulatif */}
        <View style={[st.bloc, { gap: 8 }]}>
          {retenus.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Image source={{ uri: a.img }} resizeMode="contain" style={st.vignette} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, color: C.encre }}>{a.name}</Text>
                <Text style={{ fontSize: 11.5, color: C.gris }}>
                  × {a.quantite || 1}{[a.couleur, a.taille].filter(Boolean).length
                    ? ` · ${[a.couleur, a.taille].filter(Boolean).join(' · ')}` : ''}
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700' }}>
                {fcfa(a.price * (a.quantite || 1))}
              </Text>
            </View>
          ))}

          <View style={st.separateur} />
          <Rangee libelle="Articles" valeur={fcfa(sousTotal)} />
          <Rangee libelle="Livraison" valeur={frais ? fcfa(frais) : 'Gratuit'} vert={!frais} />
          <View style={st.separateur} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '800' }}>Total</Text>
            <Text style={{ fontSize: 20, fontWeight: '800' }}>{fcfa(total)}</Text>
          </View>
        </View>

        {!!msg && (
          <Text style={{ color: C.rouge, fontSize: 13, textAlign: 'center', marginTop: 12 }}>
            {msg}
          </Text>
        )}
      </ScrollView>

      <View style={st.pied}>
        <Pressable onPress={() => valider(true)} disabled={busy} style={[S.bouton, busy && S.boutonEteint]}>
          <Text style={S.boutonTexte}>{busy ? '…' : `Payer ${fcfa(total)}`}</Text>
        </Pressable>
        <Pressable onPress={() => valider(false)} disabled={busy} style={{ paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, color: C.gris, textAlign: 'center' }}>
            Ou payer à la livraison
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Rangee({ libelle, valeur, vert }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13.5, color: C.gris }}>{libelle}</Text>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: vert ? C.vert : C.encre }}>
        {valeur}
      </Text>
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

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1.5, borderColor: C.bord, borderRadius: R.champ, padding: 12,
  },
  moyen: {
    flex: 1, alignItems: 'center', borderWidth: 1.5, borderColor: C.bord,
    borderRadius: R.champ, paddingVertical: 12,
  },
  optionChoisie: { borderColor: C.orange, backgroundColor: C.orangePale },

  vignette: { width: 42, height: 50, borderRadius: 8, backgroundColor: '#FFF' },
  separateur: { height: 1, backgroundColor: C.bord, marginVertical: 3 },

  pied: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.carte, borderTopWidth: 1, borderTopColor: C.bord,
    paddingHorizontal: E.page, paddingTop: 12, paddingBottom: 12,
  },
});
