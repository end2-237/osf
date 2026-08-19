import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fcfa } from '../lib/relais';

/* ══════════════════════════════════════════════════════════════════════════
   LE BON DE RELAIS — la troisième poche

   Ce n'est pas le solde des ventes. C'est ce que la boutique a gagné en
   ENVOYANT des clients ailleurs : 5 % de chaque vente qu'elle a provoquée
   sans rien vendre elle-même. Le confondre avec le chiffre d'affaires serait
   une faute comptable, d'où deux blocs séparés à l'écran.

   Trois sorties, et l'ordre dans lequel elles sont présentées n'est pas
   neutre.

   GARDER pour ses propres remises vient en premier : c'est la seule qui ne
   coûte rien à honorer et la seule qui ramène un client dans la boutique.
   Un bon dépensé en remise revient sous forme de vente.

   PAYER L'ABONNEMENT vient ensuite. Un abonnement réglé avec du bon est un
   commerçant qui reste sans avoir à sortir un billet.

   RETIRER EN ARGENT vient en dernier, et à partir de 15 000 F. Le plancher
   n'est pas une contrainte arbitraire : sous ce montant, les frais de
   collecte de l'opérateur mangent une part indécente du versement. Et le
   délai de trente jours fait que l'essentiel continue de circuler à
   l'intérieur du réseau plutôt que d'en sortir au premier mois.
   ══════════════════════════════════════════════════════════════════════════ */

const PLANCHER = 15000;

const MOTIFS = {
  relais:        { label: 'Client envoyé',      icone: 'fa-arrow-right-from-bracket', cls: 'text-emerald-600' },
  remise_client: { label: 'Remise client',      icone: 'fa-tag',                      cls: 'text-gray-500' },
  abonnement:    { label: 'Abonnement',         icone: 'fa-crown',                    cls: 'text-gray-500' },
  retrait:       { label: 'Retrait',            icone: 'fa-money-bill-transfer',      cls: 'text-gray-500' },
  correction:    { label: 'Correction',         icone: 'fa-pen',                      cls: 'text-gray-500' },
};

const METHODS = [
  { key: 'orange_money', label: 'Orange Money' },
  { key: 'mtn_momo',     label: 'MTN MoMo' },
];

export default function BonRelaisSection({ vendor, showToast }) {
  const [solde, setSolde]   = useState(null);
  const [lignes, setLignes] = useState([]);
  const [abo, setAbo]       = useState(null);
  const [charge, setCharge] = useState(true);
  const [choix, setChoix]   = useState(null);      // null · 'remise' · 'abonnement' · 'retrait'
  const [montant, setMont]  = useState('');
  const [methode, setMeth]  = useState('orange_money');
  const [note, setNote]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState(null);

  const load = useCallback(async () => {
    if (!vendor?.id) return;
    const [s, m, a] = await Promise.all([
      supabase.rpc('solde_bon', { p_vendor_id: vendor.id }),
      supabase.rpc('mouvements_bon', { p_vendor_id: vendor.id, p_limite: 20 }),
      supabase.from('subscription_orders')
        .select('id, amount, to_plan, months, status')
        .eq('vendor_id', vendor.id).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSolde(s.data?.[0] || null);
    setLignes(m.data || []);
    setAbo(a.data || null);
    setCharge(false);
  }, [vendor?.id]);

  useEffect(() => { load(); }, [load]);

  const total     = Number(solde?.solde || 0);
  const retirable = Number(solde?.retirable || 0);
  const gagne30   = Number(solde?.gagne_30j || 0);

  const fermer = () => { setChoix(null); setMont(''); setNote(''); setMsg(null); };

  const executer = async () => {
    setBusy(true); setMsg(null);
    try {
      if (choix === 'abonnement') {
        const { error } = await supabase.rpc('payer_abonnement_avec_bon', { p_vendor_id: vendor.id });
        if (error) throw error;
        showToast?.('Abonnement réglé avec ton bon');
      } else {
        const n = Math.round(Number(montant) || 0);
        if (n <= 0) throw new Error('Entre un montant.');

        if (choix === 'retrait') {
          const { error } = await supabase.rpc('retirer_bon', {
            p_vendor_id: vendor.id, p_montant: n, p_method: methode,
          });
          if (error) throw error;
          showToast?.('Demande de retrait envoyée');
        } else {
          const { error } = await supabase.rpc('depenser_bon', {
            p_vendor_id: vendor.id, p_montant: n, p_motif: 'remise_client',
            p_note: note.trim() || null,
          });
          if (error) throw error;
          showToast?.('Remise enregistrée');
        }
      }
      fermer();
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally { setBusy(false); }
  };

  if (!vendor) return null;

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl p-5 space-y-4">
      <div>
        <p className="font-bold text-[15px] mb-1">Ton bon de relais</p>
        <p className="text-[13px] text-gray-500 leading-relaxed">
          Ce que tu as gagné en <b className="text-gray-700">envoyant</b> des clients chez des
          voisins — 5 % de chaque vente que tu as provoquée sans rien vendre.
          C’est une poche à part : ce n’est pas ton chiffre d’affaires.
        </p>
      </div>

      {charge ? (
        <div className="h-24 bg-gray-50 rounded-xl animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bon disponible', value: total, strong: true },
              { label: 'Gagné sur 30 jours', value: gagne30 },
              { label: 'Retirable en argent', value: retirable },
            ].map((b) => (
              <div key={b.label} className={`rounded-xl p-3 ${b.strong ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
                <p className={`text-[11px] font-semibold ${b.strong ? 'text-white/60' : 'text-gray-400'}`}>{b.label}</p>
                <p className={`text-[17px] font-bold mt-1 ${b.strong ? '' : 'text-gray-900'}`}>{fcfa(b.value)}</p>
              </div>
            ))}
          </div>

          {total === 0 ? (
            <p className="text-[12px] text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
              <i className="fa-solid fa-circle-info mr-1.5" />
              Ton bon se remplit quand un client que <b>tu as envoyé</b> repart avec son article
              d’une autre boutique. Il n’existe qu’à ce moment-là — pas à l’envoi,
              pas au paiement : à la confirmation.
            </p>
          ) : !choix ? (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Qu’est-ce que tu en fais ?
              </p>

              <button onClick={() => setChoix('remise')}
                className="w-full text-left rounded-xl border border-gray-200 hover:border-gray-900 px-4 py-3 transition-colors">
                <p className="text-[14px] font-bold text-gray-900">
                  <i className="fa-solid fa-tag text-emerald-600 mr-2" />
                  Le garder pour mes remises client
                </p>
                <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  Tu l’utilises pour baisser un prix chez toi. C’est la seule option qui te
                  ramène un client — le bon dépensé revient en vente.
                </p>
              </button>

              <button onClick={() => setChoix('abonnement')}
                className="w-full text-left rounded-xl border border-gray-200 hover:border-gray-900 px-4 py-3 transition-colors">
                <p className="text-[14px] font-bold text-gray-900">
                  <i className="fa-solid fa-crown text-amber-500 mr-2" />
                  Payer mon abonnement
                </p>
                <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  {abo
                    ? <>Ton forfait <b>{abo.to_plan}</b> en attente coûte {fcfa(abo.amount)}
                        {total < abo.amount ? ` — il te manque ${fcfa(abo.amount - total)}.` : '. Tu peux le régler maintenant.'}</>
                    : 'Choisis d’abord un forfait dans « Abonnement ». Tu pourras le régler ici sans sortir un billet.'}
                </p>
              </button>

              <button onClick={() => setChoix('retrait')} disabled={retirable < PLANCHER}
                className="w-full text-left rounded-xl border border-gray-200 hover:border-gray-900 px-4 py-3 transition-colors disabled:opacity-50 disabled:hover:border-gray-200">
                <p className="text-[14px] font-bold text-gray-900">
                  <i className="fa-solid fa-money-bill-transfer text-gray-500 mr-2" />
                  Le retirer en argent
                </p>
                <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  {retirable < PLANCHER
                    ? <>À partir de {fcfa(PLANCHER)}, et trente jours après avoir été gagné.
                        Tu as {fcfa(retirable)} de retirable pour l’instant.</>
                    : <>Jusqu’à {fcfa(retirable)} sur Orange Money ou MTN MoMo.
                        Traité sous 48 h ouvrées.</>}
                </p>
              </button>

              <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                Le plancher de {fcfa(PLANCHER)} n’est pas là pour te retenir : en dessous,
                les frais de l’opérateur mangent une part indécente du versement. Gardé,
                le bon vaut plus qu’il ne vaudrait retiré.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-gray-900 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-bold text-gray-900">
                  {choix === 'remise'     && 'Utiliser en remise client'}
                  {choix === 'abonnement' && 'Payer mon abonnement'}
                  {choix === 'retrait'    && 'Retirer en argent'}
                </p>
                <button onClick={fermer} className="text-[12px] text-gray-400 shrink-0">Annuler</button>
              </div>

              {choix === 'abonnement' ? (
                abo ? (
                  <p className="text-[13px] text-gray-600 leading-relaxed">
                    Forfait <b className="text-gray-900">{abo.to_plan}</b> · {abo.months} mois ·{' '}
                    <b className="text-gray-900">{fcfa(abo.amount)}</b>.
                    {total < abo.amount
                      ? ` Il te manque ${fcfa(abo.amount - total)} de bon.`
                      : ' Le forfait prend effet immédiatement.'}
                  </p>
                ) : (
                  <p className="text-[13px] text-gray-600 leading-relaxed">
                    Aucun abonnement en attente. Va d’abord choisir un forfait dans
                    « Abonnement », puis reviens ici pour le régler avec ton bon.
                  </p>
                )
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5">
                      Montant {choix === 'retrait' && `(minimum ${fcfa(PLANCHER)})`}
                    </label>
                    <input value={montant} onChange={(e) => setMont(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      placeholder={choix === 'retrait' ? String(PLANCHER) : '0'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900" />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Maximum {fcfa(choix === 'retrait' ? retirable : total)}
                    </p>
                  </div>

                  {choix === 'retrait' && (
                    <div className="flex gap-2">
                      {METHODS.map((m) => (
                        <button key={m.key} onClick={() => setMeth(m.key)}
                          className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${
                            methode === m.key ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500'}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {choix === 'remise' && (
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5">
                        À qui, sur quoi ? (facultatif)
                      </label>
                      <input value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="Remise sur la vente de M. Ngono"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900" />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Pour t’y retrouver dans ton journal. Personne d’autre ne le lit.
                      </p>
                    </div>
                  )}
                </>
              )}

              {msg && (
                <p className="text-[12px] text-red-500">
                  <i className="fa-solid fa-circle-exclamation mr-1.5" />{msg.text}
                </p>
              )}

              <button onClick={executer}
                disabled={busy || (choix === 'abonnement' && (!abo || total < abo.amount))}
                className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40">
                {busy ? '…'
                  : choix === 'remise'     ? 'Enregistrer la remise'
                  : choix === 'abonnement' ? 'Régler avec mon bon'
                  : 'Demander le retrait'}
              </button>
            </div>
          )}

          {lignes.length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                Journal du bon
              </p>
              <div className="divide-y divide-gray-100">
                {lignes.map((l) => {
                  const m = MOTIFS[l.motif] || MOTIFS.correction;
                  const credit = l.montant > 0;
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">
                          <i className={`fa-solid ${m.icone} ${m.cls} mr-1.5 text-[11px]`} />
                          {m.label}
                        </p>
                        {l.note && <p className="text-[11px] text-gray-400 truncate">{l.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[13px] font-bold ${credit ? 'text-emerald-600' : 'text-gray-900'}`}>
                          {credit ? '+' : '−'} {fcfa(Math.abs(l.montant))}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(l.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
