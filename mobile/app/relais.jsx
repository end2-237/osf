import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Image, Linking, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import {
  monRelais, maPresence, signalerPresence, boutiqueParCode,
  payerRelais, confirmerRemise, annulerRelais, renoncerAuComptoir,
  etatCommandes, pousserUssd, OPERATEURS, fcfa, resteAvant, etapes,
} from '../lib/relais';
import { C, S } from '../lib/theme';

/* ══════════════════════════════════════════════════════════════════════════
   MON RELAIS — l'écran du client

   Le même parcours que sur le web, avec une différence qui compte : ici il a
   l'application ouverte pendant qu'il marche. Le code reste énorme, le prix
   reste au-dessus du chemin, et le paiement se fait sur place.
   ══════════════════════════════════════════════════════════════════════════ */

export default function Relais() {
  const { user, charge } = useSession();
  const router = useRouter();
  const [r, setR] = useState(null);
  const [presence, setPresence] = useState(null);
  const [chargeR, setChargeR] = useState(true);
  const [reste, setReste] = useState(null);
  const [msg, setMsg] = useState('');

  const recharger = async () => {
    const { data } = await monRelais();
    const rel = data?.[0] || null;
    setR(rel);
    if (!rel) {
      const { data: p } = await maPresence();
      setPresence(p?.[0] || null);
    } else setPresence(null);
    setChargeR(false);
  };

  useEffect(() => {
    if (charge) return;
    if (!user) { router.replace('/connexion'); return; }
    recharger();
  }, [charge, user]);

  // Tant qu'aucun relais ne lui est attribué, il est debout devant un
  // comptoir : il ne va pas tirer sur l'écran pour rafraîchir.
  useEffect(() => {
    if (!user || r) return;
    const t = setInterval(recharger, 3000);
    return () => clearInterval(t);
  }, [user, r]);

  useEffect(() => {
    if (!r?.expire_le) return;
    const t = setInterval(() => setReste(resteAvant(r.expire_le)), 1000);
    setReste(resteAvant(r.expire_le));
    return () => clearInterval(t);
  }, [r?.expire_le]);

  if (charge || chargeR) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={C.encre} />
      </View>
    );
  }

  /* Il a scanné, le vendeur n'a pas encore attaché. Son code est tout ce qui
     compte à cette seconde. */
  if (!r && presence) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[S.carte, { borderWidth: 2, borderColor: C.encre, alignItems: 'center' }]}>
          <Text style={S.etiquette}>Montre ce code au vendeur</Text>
          <Text style={{ fontSize: 52, fontWeight: '900', letterSpacing: 10, color: C.encre, marginTop: 10 }}>
            {presence.code}
          </Text>
          <Text style={[S.sousTitre, { textAlign: 'center', marginTop: 10 }]}>
            Tu es chez <Text style={{ fontWeight: '700', color: C.encre }}>{presence.boutique}</Text>.
            Le vendeur le saisit, et ton article s’affiche ici.
          </Text>
        </View>
        <Text style={[S.sousTitre, { textAlign: 'center' }]}>
          Valable quinze minutes. En attente du vendeur…
        </Text>
      </ScrollView>
    );
  }

  if (!r) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <JeSuisEnBoutique onSignale={recharger} />
        <View style={[S.carte, { alignItems: 'center' }]}>
          <Text style={S.titre}>Aucun relais en cours</Text>
          <Text style={[S.sousTitre, { textAlign: 'center', marginTop: 6 }]}>
            Quand un commerçant n’a pas ce que tu cherches, il t’envoie chez un
            voisin qui l’a — et tu obtiens une remise.
          </Text>
        </View>
        <Pressable onPress={() => router.push('/reglages')}>
          <Text style={{ color: C.lien, fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>
            Réglages
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  const livre = r.mode === 'livre';

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>

      {/* L'article. La photo d'abord : on ne fait pas marcher quelqu'un pour
          une ligne de texte. */}
      <View style={[S.carte, { gap: 12 }]}>
        {!!r.img && (
          <Image source={{ uri: r.img }} resizeMode="contain"
            style={{ width: '100%', height: 200, backgroundColor: '#FFF' }} />
        )}
        <View>
          <Text style={S.etiquette}>
            {livre ? 'On te l’apporte' : 'Ce que tu vas chercher'}
          </Text>
          <Text style={{ fontSize: 21, fontWeight: '700', color: C.encre, marginTop: 4 }}>
            {r.libelle}
          </Text>
          <Text style={[S.sousTitre, { marginTop: 6 }]}>
            Chez <Text style={{ fontWeight: '700', color: C.encre }}>{r.boutique}</Text>
            {r.repere ? ` · ${r.repere}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: C.prix }}>{fcfa(r.prix_paye)}</Text>
            <Text style={{ fontSize: 14, color: C.gris, textDecorationLine: 'line-through' }}>
              {fcfa(r.prix_affiche)}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.vert }}>
              − {fcfa(r.remise)}
            </Text>
          </View>
          {!!reste && (
            <Text style={{ fontSize: 12, color: C.gris, marginTop: 8 }}>
              Valable encore {reste}, et seulement chez {r.boutique}.
            </Text>
          )}
        </View>
      </View>

      {/* Le chemin */}
      {r.etat === 'attribue' && !livre && (
        <View style={[S.carte, { gap: 10 }]}>
          <Text style={S.etiquette}>Ton chemin</Text>
          {etapes(r).map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11, backgroundColor: C.encre,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.encre }}>{e.t}</Text>
                {!!e.s && <Text style={{ fontSize: 12, color: C.gris }}>{e.s}</Text>}
              </View>
            </View>
          ))}
          {r.lat != null && (
            <Pressable
              onPress={() => Linking.openURL(
                `https://www.openstreetmap.org/directions?to=${r.lat},${r.lng}`)}
              style={{
                borderWidth: 1, borderColor: C.bord, borderRadius: 10,
                paddingVertical: 11, alignItems: 'center', marginTop: 4,
              }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.gris }}>
                Voir sur un plan
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Le code, en très grand : il se lit à voix haute dans une allée
          bruyante. */}
      <View style={[S.carte, {
        alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: C.bord,
      }]}>
        <Text style={S.etiquette}>
          {livre ? 'Montre ce code à celui qui apporte' : 'Montre ce code au comptoir'}
        </Text>
        <Text style={{ fontSize: 40, fontWeight: '900', letterSpacing: 8, color: C.encre, marginTop: 8 }}>
          {r.code}
        </Text>
        <Text style={[S.sousTitre, { textAlign: 'center', marginTop: 8 }]}>
          Il ne marche que chez {r.boutique}.
        </Text>
      </View>

      {r.etat === 'arrive' && <Paiement r={r} onPaye={recharger} />}

      {r.etat === 'paye' && (
        <View style={[S.carte, { gap: 8 }]}>
          <Pressable onPress={async () => {
            const { error } = await confirmerRemise(r.id);
            if (error) { setMsg(error.message); return; }
            setR(null); recharger();
          }} style={[S.bouton, { backgroundColor: C.vert }]}>
            <Text style={[S.boutonTexte, { color: '#FFF' }]}>J’ai mon article</Text>
          </Pressable>
          <Text style={[S.sousTitre, { textAlign: 'center' }]}>
            Ne confirme qu’une fois l’article en main.
          </Text>
        </View>
      )}

      {r.etat === 'attribue' && (
        <Pressable onPress={() => annulerRelais(r.id).then(recharger)}>
          <Text style={{ color: C.lien, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
            Finalement, je n’y vais pas
          </Text>
        </Pressable>
      )}

      {!!msg && <Text style={{ color: C.prix, fontSize: 13, textAlign: 'center' }}>{msg}</Text>}
    </ScrollView>
  );
}

/* ── LE PAIEMENT ──────────────────────────────────────────────────────────── */

function Paiement({ r, onPaye }) {
  const [phase, setPhase] = useState('choix');
  const [moyen, setMoyen] = useState('orange_money');
  const [tel, setTel] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [orderId, setOrder] = useState(null);
  const minuteur = useRef(null);

  useEffect(() => {
    if (phase !== 'attente' || !orderId) return;
    const debut = Date.now();
    minuteur.current = setInterval(async () => {
      if (Date.now() - debut > 8 * 60 * 1000) {
        clearInterval(minuteur.current);
        setPhase('choix');
        setMsg('Délai dépassé. Vérifie ton téléphone, ou reprends plus tard.');
        return;
      }
      const { data } = await etatCommandes([orderId]);
      const etat = data?.[0]?.status;
      if (etat === 'paid') { clearInterval(minuteur.current); onPaye(); }
      else if (etat === 'payment_failed' || etat === 'cancelled') {
        clearInterval(minuteur.current);
        setPhase('choix');
        setMsg('Paiement refusé ou annulé. Vérifie ton solde et réessaie.');
      }
    }, 5000);
    return () => clearInterval(minuteur.current);
  }, [phase, orderId]);

  const payer = async () => {
    const num = tel.replace(/\D/g, '');
    if (num.length < 9) { setMsg('Le numéro qui paie, à 9 chiffres.'); return; }
    setBusy(true); setMsg('');
    const { data, error } = await payerRelais(r.id, moyen);
    if (error) { setBusy(false); setMsg(error.message); return; }
    const oid = data?.[0]?.order_id;
    if (!oid) { setBusy(false); setMsg('La commande n’a pas pu être créée.'); return; }
    setOrder(oid);
    try {
      await pousserUssd({ orderId: oid, montant: r.prix_paye, tel: num, moyen });
      setPhase('attente');
    } catch (e) {
      setMsg(e.message);
    } finally { setBusy(false); }
  };

  if (phase === 'attente') {
    return (
      <View style={[S.carte, { gap: 8 }]}>
        <Text style={S.titre}>Compose le code sur ton téléphone</Text>
        <Text style={S.sousTitre}>
          Un message vient d’arriver sur le {tel}. Valide-le avec ton code
          secret. Cet écran se met à jour tout seul.
        </Text>
        <ActivityIndicator color={C.encre} style={{ marginTop: 4 }} />
      </View>
    );
  }

  return (
    <View style={[S.carte, { gap: 10 }]}>
      <Text style={S.etiquette}>Payer {fcfa(r.prix_paye)}</Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {OPERATEURS.map(([cle, nom]) => (
          <Pressable key={cle} onPress={() => setMoyen(cle)}
            style={{
              flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11,
              alignItems: 'center',
              borderColor: moyen === cle ? C.encre : C.bord,
              backgroundColor: moyen === cle ? '#F7FAFA' : 'transparent',
            }}>
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: moyen === cle ? C.encre : C.gris,
            }}>{nom}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput value={tel} onChangeText={setTel} keyboardType="numeric"
        placeholder="Numéro qui paie — 6XX XX XX XX" placeholderTextColor="#9AA0A6"
        style={S.champ} />

      <Pressable onPress={payer} disabled={busy}
        style={[S.bouton, busy && { opacity: 0.4 }]}>
        <Text style={S.boutonTexte}>{busy ? '…' : `Payer ${fcfa(r.prix_paye)}`}</Text>
      </Pressable>

      <Text style={{ fontSize: 11, color: C.gris }}>
        Tu paies maintenant et tu retires au comptoir avec ton code. Le
        commerçant n’est payé qu’une fois que tu as confirmé l’avoir en main.
      </Text>

      {!!msg && <Text style={{ color: C.prix, fontSize: 13 }}>{msg}</Text>}

      {/* La sortie de secours, jamais mise en avant. */}
      <Pressable onPress={() => renoncerAuComptoir(r.id).then(onPaye)}>
        <Text style={{ color: C.lien, fontSize: 13, textAlign: 'center', paddingVertical: 6 }}>
          Je ne paie pas maintenant
        </Text>
      </Pressable>
    </View>
  );
}

/* ── JE SUIS DANS UNE BOUTIQUE ────────────────────────────────────────────── */

function JeSuisEnBoutique({ onSignale }) {
  const [code, setCode] = useState('');
  const [boutique, setBout] = useState(null);
  const [cherche, setCherche] = useState(false);
  const [resolu, setResolu] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const c = code.trim();
    if (c.length < 4) { setBout(null); setResolu(''); setCherche(false); return; }
    let vivant = true;
    setCherche(true);
    const t = setTimeout(() => {
      boutiqueParCode(c)
        .then(({ data }) => {
          if (!vivant) return;
          setBout(data?.[0] || null);
          setResolu(c);
        })
        .finally(() => { if (vivant) setCherche(false); });
    }, 300);
    return () => { vivant = false; clearTimeout(t); };
  }, [code]);

  const valider = async () => {
    setBusy(true); setMsg('');
    const { error } = await signalerPresence(code.trim());
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onSignale();
  };

  return (
    <View style={[S.carte, { gap: 10, borderWidth: 2, borderColor: C.encre }]}>
      <View>
        <Text style={S.titre}>Je suis dans une boutique</Text>
        <Text style={[S.sousTitre, { marginTop: 4 }]}>
          Le vendeur n’a pas ton article ? Tape le code de son comptoir.
        </Text>
      </View>

      <TextInput value={code}
        onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        autoCapitalize="characters" maxLength={12}
        placeholder="ABC123" placeholderTextColor="#9AA0A6"
        style={[S.champ, { textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 6 }]} />

      {cherche ? (
        <Text style={{ fontSize: 12, color: C.gris, textAlign: 'center' }}>
          On cherche la boutique…
        </Text>
      ) : boutique ? (
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.vert, textAlign: 'center' }}>
          {boutique.boutique}
        </Text>
      ) : resolu === code.trim() ? (
        <Text style={{ fontSize: 12, color: C.gris, textAlign: 'center' }}>
          Aucune boutique avec ce code — vérifie l’affiche.
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: C.gris, textAlign: 'center' }}>
          Le code est écrit en gros sur l’affiche du comptoir.
        </Text>
      )}

      <Pressable onPress={valider} disabled={busy || cherche || !boutique}
        style={[S.bouton, (busy || cherche || !boutique) && { opacity: 0.4 }]}>
        <Text style={S.boutonTexte}>{busy ? 'On te signale…' : 'Je suis ici'}</Text>
      </Pressable>

      {!!msg && <Text style={{ color: C.prix, fontSize: 13, textAlign: 'center' }}>{msg}</Text>}
    </View>
  );
}
