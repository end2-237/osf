import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../lib/session';
import {
  appelsEnAttente, repondreAppel, chercherDansRayon, lancerAppel,
  classerRepondants, attribuerRelais, presencesDuComptoir,
  validerCode, declarerRupture, relaisDuComptoir, soldeBon,
  pousserNotifications, fcfa,
} from '../lib/relais';
import { enregistrerPourNotifications } from '../lib/notifications';
import { C, S } from '../lib/theme';

/* ══════════════════════════════════════════════════════════════════════════
   LE COMPTOIR

   C'est l'écran qui justifie l'application mobile. Tout le reste existe déjà
   dans le navigateur ; ce qui n'y existe pas, c'est une notification qui
   sonne dans la poche d'un commerçant occupé, et trente secondes pour
   répondre.

   D'où l'ordre : RÉPONDRE est toujours en haut, avant tout le reste, et il
   s'interroge toutes les trois secondes en plus de la notification. Un
   commerçant dont le téléphone a refusé les notifications doit pouvoir
   répondre quand même — sinon on perd sa couverture, et la couverture est ce
   qui décide de la valeur du rayon.
   ══════════════════════════════════════════════════════════════════════════ */

const MOTIFS = [
  ['trop_loin', 'Trop loin'],
  ['refus', 'Il n’en veut pas'],
  ['prix', 'Prix trop haut'],
  ['autre', 'Autre'],
];

export default function Comptoir() {
  const { vendor, user, charge } = useSession();
  const router = useRouter();
  const [onglet, setOnglet] = useState('repondre');
  const [rafraichit, setRaf] = useState(false);

  useEffect(() => {
    if (!charge && !user) router.replace('/connexion');
  }, [charge, user]);

  useEffect(() => {
    if (vendor?.id) enregistrerPourNotifications(vendor.id);
  }, [vendor?.id]);

  if (charge) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={C.encre} />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={{ padding: 16 }}>
        <View style={S.carte}>
          <Text style={S.titre}>Ce compte n’a pas de boutique</Text>
          <Text style={[S.sousTitre, { marginTop: 6 }]}>
            Le comptoir s’ouvre pour les boutiques. Si tu es client, ton relais
            est dans l’autre écran.
          </Text>
          <Pressable onPress={() => router.replace('/relais')}
            style={[S.boutonSombre, { marginTop: 12 }]}>
            <Text style={S.boutonSombreTexte}>Voir mon relais</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ONGLETS = [
    ['repondre', 'Répondre'],
    ['envoyer', 'Envoyer'],
    ['recevoir', 'Un client arrive'],
    ['journal', 'Mes relais'],
  ];

  return (
    <ScrollView
      contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl refreshing={rafraichit} onRefresh={() => {
          setRaf(true); setTimeout(() => setRaf(false), 600);
        }} />
      }>

      {/* Toujours au-dessus, quel que soit l'onglet : un appel dure trente
          secondes et ne peut pas attendre qu'il navigue. */}
      <Repondre vendor={vendor} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {ONGLETS.map(([k, l]) => (
          <Pressable key={k} onPress={() => setOnglet(k)}
            style={{
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
              backgroundColor: onglet === k ? C.encre : '#EDEFEF',
            }}>
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: onglet === k ? '#FFF' : C.gris,
            }}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {onglet === 'envoyer' && <Envoyer vendor={vendor} />}
      {onglet === 'recevoir' && <Recevoir vendor={vendor} />}
      {onglet === 'journal' && <Journal vendor={vendor} />}

      <Pressable onPress={() => router.push('/reglages')}>
        <Text style={{ color: C.lien, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
          Réglages et version
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/* ── RÉPONDRE ─────────────────────────────────────────────────────────────── */

function Repondre({ vendor }) {
  const [appels, setAppels] = useState([]);
  const [prix, setPrix] = useState({});
  const [libelles, setLibelles] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    const { data } = await appelsEnAttente(vendor.id);
    setAppels(data || []);
  }, [vendor.id]);

  useEffect(() => {
    charger();
    const t = setInterval(charger, 3000);
    return () => clearInterval(t);
  }, [charger]);

  const repondre = async (a, dispo) => {
    setBusy(a.id); setMsg('');
    const { error } = await repondreAppel(a.id, vendor.id, dispo, {
      productId: a.product_id ?? null,
      libelle: libelles[a.id] || a.libelle,
      prixNet: dispo ? Number(prix[a.id] || a.prix_net || 0) : null,
    });
    setBusy('');
    if (error) { setMsg(error.message); return; }
    charger();
  };

  if (!appels.length) return null;

  return (
    <View style={[S.carte, { borderWidth: 2, borderColor: C.encre, gap: 12 }]}>
      <View>
        <Text style={S.titre}>
          {appels.length === 1 ? 'Un client cherche ça' : `${appels.length} clients cherchent`}
        </Text>
        <Text style={[S.sousTitre, { marginTop: 3 }]}>
          Trente secondes. Réponds même si tu n’as pas : « non » vaut mieux que
          rien, il compte dans ton taux de réponse.
        </Text>
      </View>

      {appels.map((a) => (
        <View key={a.id} style={{
          borderTopWidth: 1, borderTopColor: C.bordClair, paddingTop: 12, gap: 9,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.encre }}>
            {a.libelle}
          </Text>
          {!!a.contrainte && (
            <Text style={S.sousTitre}>{a.contrainte}</Text>
          )}

          {a.forme === 'ouvert' && (
            <>
              <TextInput
                value={libelles[a.id] ?? ''} onChangeText={(v) => setLibelles((s) => ({ ...s, [a.id]: v }))}
                placeholder="Ce que tu as exactement" placeholderTextColor="#9AA0A6"
                style={S.champ} />
              <TextInput
                value={prix[a.id] ?? ''} onChangeText={(v) => setPrix((s) => ({ ...s, [a.id]: v.replace(/\D/g, '') }))}
                keyboardType="numeric" placeholder="Ton prix net, en F"
                placeholderTextColor="#9AA0A6" style={S.champ} />
              <Text style={{ fontSize: 11, color: C.gris }}>
                Ton prix net est ce que tu touches. Le client paiera un peu plus,
                et cette majoration ne sort pas de ta poche.
              </Text>
            </>
          )}

          {a.forme === 'ferme' && a.prix_net != null && (
            <Text style={S.sousTitre}>
              Ta fiche : <Text style={{ fontWeight: '700', color: C.encre }}>{fcfa(a.prix_net)}</Text> net
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => repondre(a, true)} disabled={busy === a.id}
              style={[S.bouton, { flex: 1 }, busy === a.id && { opacity: 0.4 }]}>
              <Text style={S.boutonTexte}>Je l’ai</Text>
            </Pressable>
            <Pressable onPress={() => repondre(a, false)} disabled={busy === a.id}
              style={{
                flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: 'center',
                borderWidth: 1, borderColor: C.bord,
              }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.gris }}>
                Je ne l’ai pas
              </Text>
            </Pressable>
          </View>
        </View>
      ))}

      {!!msg && <Text style={{ color: C.prix, fontSize: 13 }}>{msg}</Text>}
    </View>
  );
}

/* ── ENVOYER ──────────────────────────────────────────────────────────────── */

function Envoyer({ vendor }) {
  const [texte, setTexte] = useState('');
  const [res, setRes] = useState(null);
  const [appel, setAppel] = useState(null);
  const [reste, setReste] = useState(0);
  const [rangs, setRangs] = useState([]);
  const [choix, setChoix] = useState(null);
  const [motif, setMotif] = useState('');
  const [code, setCode] = useState('');
  const [presences, setPres] = useState([]);
  const [fini, setFini] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const minuteur = useRef(null);

  const chercher = async () => {
    if (!texte.trim()) return;
    setBusy(true); setMsg(''); setRes(null); setAppel(null); setFini(null);
    const { data, error } = await chercherDansRayon(vendor.id, texte.trim());
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setRes(data || []);
  };

  const appeler = async (produit) => {
    setBusy(true); setMsg('');
    const { data, error } = await lancerAppel(vendor.id, produit?.nom || texte.trim(), {
      productId: produit?.product_id ?? null,
      familleId: produit?.famille_id ?? null,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    const a = data?.[0];
    if (!a?.appel_id) { setMsg('Personne à interroger pour cet article.'); return; }
    setAppel(a);
    setReste(30);
    pousserNotifications();

    clearInterval(minuteur.current);
    minuteur.current = setInterval(() => {
      setReste((r) => {
        if (r <= 1) {
          clearInterval(minuteur.current);
          classerRepondants(a.appel_id).then(({ data: d }) => setRangs(d || []));
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(minuteur.current), []);

  useEffect(() => {
    if (!choix) return;
    presencesDuComptoir(vendor.id).then(({ data }) => setPres(data || []));
    const t = setInterval(
      () => presencesDuComptoir(vendor.id).then(({ data }) => setPres(data || [])),
      3000,
    );
    return () => clearInterval(t);
  }, [choix, vendor.id]);

  const attribuer = async () => {
    setBusy(true); setMsg('');
    const { data, error } = await attribuerRelais(
      appel.appel_id, choix.vendor_id, null, choix.prix_net,
      {
        productId: choix.product_id ?? null,
        libelle: choix.libelle ?? texte.trim(),
        rangPropose: 1,
        rangChoisi: choix.rang,
        motifEcart: choix.rang > 1 ? motif : null,
        codeClient: code.trim(),
      },
    );
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setFini(data?.[0] || null);
  };

  if (fini) {
    return (
      <View style={[S.carte, { gap: 8 }]}>
        <Text style={S.titre}>C’est envoyé</Text>
        <Text style={S.sousTitre}>
          Le client a son chemin et son code sur son téléphone. Tu peux
          retourner à ton comptoir.
        </Text>
        <View style={{
          backgroundColor: '#F0F9F0', borderRadius: 10, padding: 12, marginTop: 4,
        }}>
          <Text style={S.etiquette}>Ton bon, si la vente se fait</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.vert, marginTop: 2 }}>
            {fcfa(fini.bon)}
          </Text>
          <Text style={{ fontSize: 11, color: C.gris, marginTop: 4 }}>
            Réservé, pas encore crédité. Il le sera quand le client confirmera
            avoir son article.
          </Text>
        </View>
        <Pressable onPress={() => { setFini(null); setTexte(''); setRes(null); setChoix(null); setCode(''); }}
          style={[S.boutonSombre, { marginTop: 6 }]}>
          <Text style={S.boutonSombreTexte}>Envoyer un autre client</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={[S.carte, { gap: 10 }]}>
        <Text style={S.etiquette}>Qu’est-ce qu’il cherche ?</Text>
        <TextInput
          value={texte} onChangeText={setTexte} onSubmitEditing={chercher}
          returnKeyType="search" placeholder="timberland 45, fer à repasser…"
          placeholderTextColor="#9AA0A6" style={S.champ} />
        <Pressable onPress={chercher} disabled={busy || !texte.trim()}
          style={[S.bouton, (busy || !texte.trim()) && { opacity: 0.4 }]}>
          <Text style={S.boutonTexte}>{busy ? '…' : 'Chercher'}</Text>
        </Pressable>
      </View>

      {res && !appel && (
        <View style={[S.carte, { gap: 10 }]}>
          {(() => {
            const chezMoi = res.filter((r) => r.source === 'moi');
            const auRayon = res.filter((r) => r.source === 'rayon');
            return (
              <>
                {chezMoi.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text style={S.etiquette}>Chez toi — vends-le, pas besoin de relais</Text>
                    {chezMoi.map((r) => (
                      <Text key={r.product_id} style={{ fontSize: 14, color: C.encre }}>
                        {r.nom} · {fcfa(r.prix_net)}
                        {r.stock === 'Épuisé' ? '  (marqué épuisé)' : ''}
                      </Text>
                    ))}
                  </View>
                )}

                {auRayon.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={S.etiquette}>Dans le rayon</Text>
                    {auRayon.slice(0, 6).map((r) => (
                      <Pressable key={r.product_id} onPress={() => appeler(r)}
                        style={{
                          borderWidth: 1, borderColor: C.bord, borderRadius: 10,
                          padding: 11,
                        }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: C.encre }}>
                          {r.nom}
                        </Text>
                        <Text style={S.sousTitre}>{r.shop_name} · {fcfa(r.prix_net)} net</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <Pressable onPress={() => appeler(null)} disabled={busy}
                  style={[S.boutonSombre, busy && { opacity: 0.4 }]}>
                  <Text style={S.boutonSombreTexte}>
                    {auRayon.length ? 'Aucun ne convient — demander au rayon' : 'Demander au rayon'}
                  </Text>
                </Pressable>
                <Text style={{ fontSize: 11, color: C.gris }}>
                  L’appel part chez les boutiques qui peuvent l’avoir. Elles ont
                  trente secondes.
                </Text>
              </>
            );
          })()}
        </View>
      )}

      {appel && reste > 0 && (
        <View style={[S.carte, { alignItems: 'center', gap: 6 }]}>
          <Text style={{ fontSize: 44, fontWeight: '800', color: C.encre }}>{reste}</Text>
          <Text style={S.sousTitre}>
            {appel.interroges} boutique{appel.interroges > 1 ? 's' : ''} interrogée
            {appel.interroges > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {appel && reste === 0 && !choix && (
        <View style={[S.carte, { gap: 9 }]}>
          <Text style={S.etiquette}>Qui l’a</Text>
          {rangs.length === 0 ? (
            <Text style={S.sousTitre}>
              Personne n’a répondu. Ce n’est pas perdu : la demande est au
              journal, et elle dira quelle boutique recruter.
            </Text>
          ) : rangs.map((r) => (
            <Pressable key={r.vendor_id} onPress={() => setChoix(r)}
              style={{
                borderWidth: r.rang === 1 ? 2 : 1,
                borderColor: r.rang === 1 ? C.encre : C.bord,
                borderRadius: 10, padding: 12,
              }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.encre }}>
                {r.shop_name}
              </Text>
              <Text style={S.sousTitre}>
                {fcfa(r.prix_net)} net{r.distance_m != null ? ` · ${r.distance_m} m` : ''}
              </Text>
              {r.rang === 1 && (
                <Text style={{ fontSize: 11, color: C.vert, marginTop: 3, fontWeight: '600' }}>
                  Proposée par l’arbitrage — c’est elle qui a le plus donné au rayon
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {choix && (
        <View style={[S.carte, { gap: 10 }]}>
          <Text style={S.titre}>Identifie le client</Text>
          <Text style={S.sousTitre}>
            Dis-lui de scanner l’affiche de ton comptoir. Il a son compte et son
            code en deux gestes.
          </Text>

          {choix.rang > 1 && (
            <View style={{ gap: 6 }}>
              <Text style={S.etiquette}>Pourquoi pas la première ?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {MOTIFS.map(([k, l]) => (
                  <Pressable key={k} onPress={() => setMotif(k)}
                    style={{
                      borderWidth: 1, borderRadius: 999,
                      borderColor: motif === k ? C.encre : C.bord,
                      backgroundColor: motif === k ? '#F7FAFA' : 'transparent',
                      paddingHorizontal: 12, paddingVertical: 7,
                    }}>
                    <Text style={{ fontSize: 12, color: motif === k ? C.encre : C.gris }}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {presences.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={S.etiquette}>Vient de scanner ton comptoir</Text>
              {presences.map((p) => (
                <Pressable key={p.code} onPress={() => setCode(p.code)}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 11,
                    borderColor: code === p.code ? C.encre : C.bord,
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.encre }}>{p.nom}</Text>
                    <Text style={{ fontSize: 12, color: C.gris }}>
                      {p.telephone || '—'} · il y a {p.il_y_a_s < 60 ? `${p.il_y_a_s} s` : `${Math.round(p.il_y_a_s / 60)} min`}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: 3, color: C.encre }}>
                    {p.code}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <TextInput
            value={code} onChangeText={(v) => setCode(v.toUpperCase())}
            maxLength={4} autoCapitalize="characters"
            placeholder="Son code à 4 caractères" placeholderTextColor="#9AA0A6"
            style={[S.champ, { textAlign: 'center', fontSize: 20, fontWeight: '700', letterSpacing: 6 }]} />

          <Pressable onPress={attribuer}
            disabled={busy || !code.trim() || (choix.rang > 1 && !motif)}
            style={[S.bouton, (busy || !code.trim() || (choix.rang > 1 && !motif)) && { opacity: 0.4 }]}>
            <Text style={S.boutonTexte}>Envoyer chez {choix.shop_name}</Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: C.gris }}>
            Sans son code, le relais n’aurait pas de destinataire : il ne
            s’afficherait sur aucun téléphone et personne ne pourrait le payer.
          </Text>
        </View>
      )}

      {!!msg && <Text style={{ color: C.prix, fontSize: 13, paddingHorizontal: 4 }}>{msg}</Text>}
    </View>
  );
}

/* ── RECEVOIR ─────────────────────────────────────────────────────────────── */

function Recevoir({ vendor }) {
  const [code, setCode] = useState('');
  const [trouve, setTrouve] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const valider = async () => {
    setBusy(true); setMsg(''); setTrouve(null);
    const { data, error } = await validerCode(code.trim().toUpperCase(), vendor.id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    const r = data?.[0];
    if (!r) { setMsg('Ce code ne correspond à rien chez toi.'); return; }
    setTrouve(r);
  };

  return (
    <View style={[S.carte, { gap: 10 }]}>
      <Text style={S.titre}>Un client arrive</Text>
      <Text style={S.sousTitre}>
        Tape le code qu’il te montre. Il ne marche que chez toi.
      </Text>
      <TextInput
        value={code} onChangeText={(v) => setCode(v.toUpperCase())}
        maxLength={6} autoCapitalize="characters" onSubmitEditing={valider}
        placeholder="ABC123" placeholderTextColor="#9AA0A6"
        style={[S.champ, { textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 6 }]} />
      <Pressable onPress={valider} disabled={busy || code.trim().length < 6}
        style={[S.bouton, (busy || code.trim().length < 6) && { opacity: 0.4 }]}>
        <Text style={S.boutonTexte}>{busy ? '…' : 'Valider'}</Text>
      </Pressable>

      {trouve && (
        <View style={{
          borderTopWidth: 1, borderTopColor: C.bordClair, paddingTop: 12, gap: 6,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.encre }}>{trouve.libelle}</Text>
          <Text style={S.sousTitre}>
            Il paie <Text style={{ fontWeight: '700', color: C.prix }}>{fcfa(trouve.prix_paye)}</Text>,
            tu touches <Text style={{ fontWeight: '700', color: C.encre }}>{fcfa(trouve.prix_net)}</Text> net.
          </Text>
          <Text style={{ fontSize: 12, color: C.gris }}>
            Il règle depuis son téléphone. Ton solde bouge quand il confirme
            avoir l’article en main.
          </Text>
          <Pressable onPress={() => declarerRupture(trouve.id, vendor.id).then(() => { setTrouve(null); setCode(''); })}
            style={{ paddingVertical: 8 }}>
            <Text style={{ color: C.lien, fontSize: 13 }}>
              Finalement je ne l’ai plus — le renvoyer ailleurs
            </Text>
          </Pressable>
        </View>
      )}

      {!!msg && <Text style={{ color: C.prix, fontSize: 13 }}>{msg}</Text>}
    </View>
  );
}

/* ── JOURNAL ──────────────────────────────────────────────────────────────── */

const ETIQUETTE = {
  attribue: ['En route', C.gris],
  arrive: ['Arrivé', C.encre],
  paye: ['Payé', C.lien],
  remis: ['Terminé', C.vert],
  expire: ['Expiré', C.gris],
  rupture: ['Rupture', C.prix],
  annule: ['Annulé', C.gris],
};

function Journal({ vendor }) {
  const [lignes, setLignes] = useState([]);
  const [bon, setBon] = useState(null);

  useEffect(() => {
    relaisDuComptoir(vendor.id).then(({ data }) => setLignes(data || []));
    soldeBon(vendor.id).then(({ data }) => setBon(data?.[0] || null));
  }, [vendor.id]);

  return (
    <View style={{ gap: 12 }}>
      {bon && (
        <View style={[S.carte, { backgroundColor: C.encre }]}>
          <Text style={[S.etiquette, { color: 'rgba(255,255,255,0.6)' }]}>Ton bon de relais</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFF', marginTop: 3 }}>
            {fcfa(bon.solde)}
          </Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>
            Gagné en envoyant des clients. Retrait, abonnement ou remises :
            ça se règle depuis le site.
          </Text>
        </View>
      )}

      <View style={[S.carte, { gap: 10 }]}>
        <Text style={S.etiquette}>Mes relais</Text>
        {lignes.length === 0 ? (
          <Text style={S.sousTitre}>Rien pour l’instant.</Text>
        ) : lignes.map((l) => {
          const [txt, couleur] = ETIQUETTE[l.etat] || ['—', C.gris];
          return (
            <View key={l.id} style={{
              flexDirection: 'row', justifyContent: 'space-between', gap: 10,
              borderTopWidth: 1, borderTopColor: C.bordClair, paddingTop: 9,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.encre }} numberOfLines={1}>
                  {l.libelle}
                </Text>
                <Text style={{ fontSize: 12, color: C.gris }}>
                  {l.sens === 'envoye' ? 'Envoyé à' : 'Reçu de'} {l.autre_boutique}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: couleur }}>{txt}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
