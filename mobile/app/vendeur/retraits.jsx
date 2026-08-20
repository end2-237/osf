import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { soldeBon } from '../../lib/relais';
import { Chargement, Champ } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   RETRAITS ET BON

   Deux poches, deux blocs, et surtout pas un seul chiffre.

   Le solde des ventes est du chiffre d'affaires. Le bon de relais est ce que
   la boutique a gagné en ENVOYANT des clients ailleurs — 5 % d'une vente
   qu'elle n'a pas faite. Les mêler ferait croire au commerçant qu'il a vendu
   ce qu'il a seulement orienté, et sa comptabilité s'écroulerait dessus.

   Le bon a trois sorties, dans cet ordre : le garder pour ses remises — la
   seule qui ne coûte rien et la seule qui ramène un client —, payer son
   abonnement, le retirer à partir de 15 000 F. En dessous, les frais de
   l'opérateur mangent une part indécente du versement.
   ══════════════════════════════════════════════════════════════════════════ */

const PLANCHER = 15000;
const MOYENS = [['orange_money', 'Orange Money'], ['mtn_momo', 'MTN MoMo']];

export default function Retraits() {
  const router = useRouter();
  const { vendor } = useSession();

  const [solde, setSolde] = useState(null);
  const [bon, setBon] = useState(null);
  const [mouvements, setMouv] = useState([]);
  const [versements, setVers] = useState([]);
  const [reglages, setReglages] = useState(null);

  const [montant, setMontant] = useState('');
  const [moyen, setMoyen] = useState('orange_money');
  const [choix, setChoix] = useState(null);       // null · remise · abonnement · retrait
  const [montantBon, setMontantBon] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const charger = useCallback(async () => {
    if (!vendor?.id) return;
    const [b, s, m, v, r] = await Promise.all([
      supabase.rpc('vendor_balance', { p_vendor_id: vendor.id }),
      soldeBon(vendor.id),
      supabase.rpc('mouvements_bon', { p_vendor_id: vendor.id, p_limite: 20 }),
      supabase.rpc('my_payouts', { p_vendor_id: vendor.id }),
      supabase.from('vendor_payout_settings').select('*').eq('vendor_id', vendor.id).maybeSingle(),
    ]);
    setSolde(b.data?.[0] || null);
    setBon(s.data?.[0] || null);
    setMouv(m.data || []);
    setVers(v.data || []);
    setReglages(r.data || null);
  }, [vendor?.id]);

  useEffect(() => { charger(); }, [charger]);

  const demander = async () => {
    const n = Number(String(montant).replace(/\D/g, ''));
    if (!n) { setMsg({ t: 'err', m: 'Entre un montant.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('request_payout', {
      p_vendor_id: vendor.id, p_amount: n, p_method: moyen,
    });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setMontant(''); setMsg({ t: 'ok', m: 'Demande enregistrée. Traitée sous 48 h ouvrées.' });
    charger();
  };

  const executerBon = async () => {
    setBusy(true); setMsg(null);
    try {
      if (choix === 'abonnement') {
        const { error } = await supabase.rpc('payer_abonnement_avec_bon', { p_vendor_id: vendor.id });
        if (error) throw error;
      } else {
        const n = Number(String(montantBon).replace(/\D/g, ''));
        if (!n) throw new Error('Entre un montant.');
        const { error } = choix === 'retrait'
          ? await supabase.rpc('retirer_bon', { p_vendor_id: vendor.id, p_montant: n, p_method: moyen })
          : await supabase.rpc('depenser_bon', {
              p_vendor_id: vendor.id, p_montant: n, p_motif: 'remise_client', p_note: null });
        if (error) throw error;
      }
      setChoix(null); setMontantBon('');
      setMsg({ t: 'ok', m: 'C’est enregistré.' });
      charger();
    } catch (e) {
      setMsg({ t: 'err', m: e.message });
    } finally { setBusy(false); }
  };

  if (!solde) return <View style={S.page}><Chargement hauteur={400} /></View>;

  const dispo = Number(solde.available || 0);
  const retirable = Number(bon?.retirable || 0);
  const numeroPose = moyen === 'orange_money'
    ? reglages?.momo_orange_number : reglages?.momo_mtn_number;

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Text style={{ color: '#FFF', fontSize: 24 }}>‹</Text>
            </Pressable>
            <Text style={st.titre}>Retraits</Text>
          </View>
          <View style={st.soldeBloc}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '700' }}>
              DISPONIBLE
            </Text>
            <Text style={{ color: '#FFF', fontSize: 30, fontWeight: '800', marginTop: 3 }}>
              {fcfa(dispo)}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        {/* Le détail du solde */}
        <View style={[st.bloc, { gap: 10 }]}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tuile libelle="En attente" valeur={solde.held} />
            <Tuile libelle="Retrait en cours" valeur={solde.pending} />
            <Tuile libelle="Déjà versé" valeur={solde.withdrawn} />
          </View>
          {Number(solde.held) > 0 && (
            <Text style={{ fontSize: 11.5, color: C.orange, lineHeight: 16 }}>
              {fcfa(solde.held)} attendent la confirmation de tes clients. Une
              commande livrée devient disponible dès qu’ils confirment, ou
              automatiquement 48 h après.
            </Text>
          )}
          <Text style={{ fontSize: 11, color: C.gris, lineHeight: 15 }}>
            Buyticle ne prend aucune commission sur tes ventes : le prix de tes
            articles te revient en entier. Seules les commandes payées en ligne
            alimentent ce solde.
          </Text>
        </View>

        {/* Demander un retrait */}
        <View style={[st.bloc, { gap: 11 }]}>
          <Text style={S.titre}>Demander un retrait</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MOYENS.map(([k, nom]) => (
              <Pressable key={k} onPress={() => setMoyen(k)}
                style={[st.moyen, moyen === k && { borderColor: C.orange, backgroundColor: C.orangePale }]}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.encre }}>{nom}</Text>
              </Pressable>
            ))}
          </View>
          {!numeroPose ? (
            <Text style={{ fontSize: 12, color: C.orange }}>
              Renseigne d’abord ton numéro {moyen === 'orange_money' ? 'Orange' : 'MTN'} dans
              les réglages de la boutique.
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: C.gris }}>Vers le {numeroPose}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Champ label="Montant" value={montant} keyboardType="numeric"
                onChangeText={(v) => setMontant(v.replace(/\D/g, ''))}
                placeholder="0" aide={`Maximum ${fcfa(dispo)}`} />
            </View>
            <Pressable onPress={() => setMontant(String(dispo))} style={[S.boutonFin, { paddingHorizontal: 16 }]}>
              <Text style={S.boutonFinTexte}>Tout</Text>
            </Pressable>
          </View>
          <Pressable onPress={demander} disabled={busy || !numeroPose || dispo === 0}
            style={[S.bouton, (busy || !numeroPose || dispo === 0) && S.boutonEteint]}>
            <Text style={[S.boutonTexte, (busy || !numeroPose || dispo === 0) && S.boutonEteintTexte]}>
              {busy ? '…' : 'Demander le retrait'}
            </Text>
          </Pressable>
        </View>

        {/* Le bon de relais — poche séparée */}
        <View style={[st.bloc, { gap: 12 }]}>
          <View>
            <Text style={S.titre}>Ton bon de relais</Text>
            <Text style={[S.sousTitre, { marginTop: 4 }]}>
              Ce que tu as gagné en <Text style={{ fontWeight: '700', color: C.encre }}>envoyant</Text> des
              clients chez des voisins. C’est une poche à part : ce n’est pas ton
              chiffre d’affaires.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tuile libelle="Disponible" valeur={bon?.solde || 0} fort />
            <Tuile libelle="Sur 30 jours" valeur={bon?.gagne_30j || 0} />
            <Tuile libelle="Retirable" valeur={retirable} />
          </View>

          {!choix ? (
            Number(bon?.solde || 0) === 0 ? (
              <Text style={{ fontSize: 12, color: C.gris, lineHeight: 17 }}>
                Ton bon se remplit quand un client que tu as envoyé repart avec son
                article d’une autre boutique — à la confirmation, pas à l’envoi.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                <Sortie titre="Le garder pour mes remises client" icone="🏷"
                  sous="La seule option qui te ramène un client : le bon dépensé revient en vente."
                  onPress={() => setChoix('remise')} />
                <Sortie titre="Payer mon abonnement" icone="👑"
                  sous="Sans sortir un billet, si un forfait est en attente."
                  onPress={() => setChoix('abonnement')} />
                <Sortie titre="Le retirer en argent" icone="💸"
                  sous={retirable < PLANCHER
                    ? `À partir de ${fcfa(PLANCHER)} et trente jours. Tu as ${fcfa(retirable)} de retirable.`
                    : `Jusqu’à ${fcfa(retirable)}, traité sous 48 h.`}
                  desactive={retirable < PLANCHER}
                  onPress={() => setChoix('retrait')} />
                <Text style={{ fontSize: 11, color: C.gris, lineHeight: 15 }}>
                  Le plancher de {fcfa(PLANCHER)} n’est pas là pour te retenir : en
                  dessous, les frais de l’opérateur mangent une part indécente du
                  versement. Gardé, le bon vaut plus qu’il ne vaudrait retiré.
                </Text>
              </View>
            )
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.encre }}>
                  {choix === 'remise' ? 'Utiliser en remise'
                    : choix === 'abonnement' ? 'Payer l’abonnement' : 'Retirer en argent'}
                </Text>
                <Pressable onPress={() => { setChoix(null); setMsg(null); }}>
                  <Text style={{ fontSize: 12.5, color: C.gris }}>Annuler</Text>
                </Pressable>
              </View>
              {choix !== 'abonnement' && (
                <Champ label="Montant" value={montantBon} keyboardType="numeric"
                  onChangeText={(v) => setMontantBon(v.replace(/\D/g, ''))}
                  placeholder={choix === 'retrait' ? String(PLANCHER) : '0'}
                  aide={`Maximum ${fcfa(choix === 'retrait' ? retirable : bon?.solde || 0)}`} />
              )}
              <Pressable onPress={executerBon} disabled={busy}
                style={[S.bouton, busy && S.boutonEteint]}>
                <Text style={S.boutonTexte}>{busy ? '…' : 'Valider'}</Text>
              </Pressable>
            </View>
          )}

          {mouvements.length > 0 && (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={S.etiquette}>Journal du bon</Text>
              {mouvements.slice(0, 6).map((m) => (
                <View key={m.id} style={st.mouvement}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: C.encre }}>
                      {m.motif === 'relais' ? 'Client envoyé'
                        : m.motif === 'remise_client' ? 'Remise client'
                        : m.motif === 'abonnement' ? 'Abonnement' : 'Retrait'}
                    </Text>
                    {!!m.note && (
                      <Text numberOfLines={1} style={{ fontSize: 11, color: C.gris }}>{m.note}</Text>
                    )}
                  </View>
                  <Text style={{
                    fontSize: 13.5, fontWeight: '800',
                    color: m.montant > 0 ? C.vert : C.encre,
                  }}>
                    {m.montant > 0 ? '+' : '−'} {fcfa(Math.abs(m.montant))}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* L'historique des versements */}
        {versements.length > 0 && (
          <View style={[st.bloc, { gap: 9 }]}>
            <Text style={S.titre}>Mes versements</Text>
            {versements.map((v) => (
              <View key={v.id} style={st.mouvement}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: C.encre }}>
                    {v.method === 'orange_money' ? 'Orange Money' : 'MTN MoMo'}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.gris }}>
                    {new Date(v.requested_at).toLocaleDateString('fr-FR')} · {v.status}
                  </Text>
                </View>
                <Text style={{ fontSize: 13.5, fontWeight: '800' }}>{fcfa(v.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {!!msg && (
          <Text style={{
            fontSize: 13, textAlign: 'center', marginTop: 4,
            color: msg.t === 'err' ? C.rouge : C.vert,
          }}>{msg.m}</Text>
        )}
      </ScrollView>
    </View>
  );
}

function Tuile({ libelle, valeur, fort }) {
  return (
    <View style={[st.tuile, fort && { backgroundColor: C.marine }]}>
      <Text style={[st.tuileLibelle, fort && { color: 'rgba(255,255,255,0.6)' }]}>{libelle}</Text>
      <Text style={[st.tuileValeur, fort && { color: '#FFF' }]}>{fcfa(valeur)}</Text>
    </View>
  );
}

function Sortie({ titre, sous, icone, onPress, desactive }) {
  return (
    <Pressable onPress={desactive ? undefined : onPress}
      style={[st.sortie, desactive && { opacity: 0.5 }]}>
      <Text style={{ fontSize: 18 }}>{icone}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.encre }}>{titre}</Text>
        <Text style={{ fontSize: 11.5, color: C.gris, marginTop: 2, lineHeight: 16 }}>{sous}</Text>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  soldeBloc: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: R.carte,
    padding: 16, marginTop: 14,
  },
  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
  tuile: { flex: 1, backgroundColor: C.champ, borderRadius: R.champ, padding: 10 },
  tuileLibelle: { fontSize: 10.5, color: C.gris, fontWeight: '600' },
  tuileValeur: { fontSize: 14, fontWeight: '800', color: C.encre, marginTop: 3 },
  moyen: {
    flex: 1, alignItems: 'center', borderWidth: 1.5, borderColor: C.bord,
    borderRadius: R.champ, paddingVertical: 11,
  },
  sortie: {
    flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: C.bord,
    borderRadius: R.champ, padding: 12,
  },
  mouvement: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.bord, paddingTop: 9,
  },
});
