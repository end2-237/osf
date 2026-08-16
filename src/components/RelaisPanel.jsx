import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { chargerBareme, rayonDuVendeur, decomposer } from '../lib/rayon';
import {
  chercherDansRayon, lancerAppel, classerRepondants, attribuerRelais,
  validerCode, declarerRupture, relaisDuComptoir, soldeBon, fcfa,
  relaisALivrer, confirmerRemise, pousserNotifications,
} from '../lib/relais';

/* ══════════════════════════════════════════════════════════════════════════
   LE COMPTOIR

   Le client est debout devant lui. Tout ce qui suit se fait à une main, sur
   un téléphone, en moins de deux minutes.

   L'ordre des écrans n'est pas négociable :
     · son propre stock avant celui des autres — sinon on lui prend des ventes ;
     · le client n'est sollicité qu'une fois qu'on a quelque chose à lui donner ;
     · il ne choisit pas la boutique, il voit un classement.
   ══════════════════════════════════════════════════════════════════════════ */

const MOTIFS = [
  ['trop_loin',   'Trop loin pour le client'],
  ['refus',       'Le client n’en veut pas'],
  ['prix',        'Prix trop haut'],
  ['autre',       'Autre'],
];

const Section = ({ n, titre, actif, fait, children }) => (
  <div className={`rounded-2xl border p-4 transition-colors ${
    actif ? 'border-gray-900 bg-white' : fait ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-gray-50'}`}>
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${
        fait ? 'bg-emerald-500 text-white' : actif ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
        {fait ? '✓' : n}
      </span>
      <h3 className="text-sm font-bold text-gray-900">{titre}</h3>
    </div>
    {children}
  </div>
);

export default function RelaisPanel() {
  const { vendor } = useAuth();
  const [rayon, setRayon]     = useState(null);
  const [onglet, setOnglet]   = useState('envoyer');

  useEffect(() => {
    chargerBareme();
    rayonDuVendeur(vendor?.id).then(setRayon);
  }, [vendor?.id]);

  if (!vendor) return null;
  if (!rayon) {
    return (
      <div className="rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">
          Ta boutique n’appartient à aucun rayon pour le moment. Le relais
          s’activera dès qu’elle en rejoindra un.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[['envoyer', 'Envoyer un client'], ['recevoir', 'Un client arrive'],
          ['livrer', 'À livrer'], ['journal', 'Mes relais']]
          .map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                onglet === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {l}
            </button>
          ))}
      </div>
      {onglet === 'envoyer'  && <Envoyer vendor={vendor} rayon={rayon} />}
      {onglet === 'recevoir' && <Recevoir vendor={vendor} />}
      {onglet === 'livrer'   && <ALivrer vendor={vendor} />}
      {onglet === 'journal'  && <Journal vendor={vendor} />}
    </div>
  );
}

/* ── ENVOYER ─────────────────────────────────────────────────────────────── */

function Envoyer({ vendor, rayon }) {
  const [texte, setTexte]   = useState('');
  const [mode, setMode]     = useState('marche');
  const [res, setRes]       = useState(null);      // résultats de recherche
  const [appel, setAppel]   = useState(null);
  const [reste, setReste]   = useState(0);
  const [rangs, setRangs]   = useState([]);
  const [choix, setChoix]   = useState(null);
  const [motif, setMotif]   = useState('');
  const [code, setCode]     = useState('');
  const [fini, setFini]     = useState(null);
  const [msg, setMsg]       = useState('');
  const tick = useRef(null);

  const chercher = async () => {
    setMsg('');
    const { data, error } = await chercherDansRayon(vendor.id, texte.trim());
    if (error) { setMsg(error.message); return; }
    setRes(data || []);
  };

  const appeler = async (produit) => {
    setMsg('');
    const { data, error } = await lancerAppel(vendor.id, texte.trim(), {
      productId: produit?.product_id ?? null,
      familleId: produit?.famille_id ?? null,
    });
    if (error) { setMsg(error.message); return; }
    const a = data?.[0];
    if (!a?.appel_id) {
      // Cas C : personne dans le rayon ne tient ça. La demande part au journal,
      // et c'est elle qui dira quelle boutique recruter ensuite.
      setMsg('Personne dans le rayon ne tient cet article. La demande est enregistrée.');
      return;
    }
    setAppel(a);
    setRes(null);
    // Les trente secondes commencent maintenant : on pousse sans attendre la
    // tâche planifiée, sinon la moitié du délai est déjà passée à l'arrivée.
    pousserNotifications();
    const fin = new Date(a.expire_le).getTime();
    clearInterval(tick.current);
    tick.current = setInterval(async () => {
      const s = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
      setReste(s);
      const { data: r } = await classerRepondants(a.appel_id);
      setRangs(r || []);
      if (s === 0) clearInterval(tick.current);
    }, 1000);
  };

  useEffect(() => () => clearInterval(tick.current), []);

  const attribuer = async () => {
    if (!choix) return;
    setMsg('');
    // Le client scanne l'affiche du comptoir puis lit son code à six caractères.
    // On ne lui demande rien avant : une fois sur dix, personne n'a l'article.
    const { data, error } = await attribuerRelais(
      appel.appel_id, choix.vendor_id, null, choix.prix_net,
      { productId: choix.product_id, mode, rangChoisi: choix.rang,
        motif: choix.rang > 1 ? motif : null });
    if (error) { setMsg(error.message); return; }
    setFini(data?.[0]);
  };

  if (fini) {
    return (
      <Section n="✓" titre="Client envoyé" fait>
        <p className="text-sm text-gray-700">
          Il a son code <b className="tracking-widest">{fini.code}</b> et son chemin.
        </p>
        <p className="text-[13px] text-emerald-700 font-semibold mt-2">
          + {fcfa(fini.bon)} de bon pour toi si la vente se fait.
        </p>
        <p className="text-[12px] text-gray-500 mt-1">
          Tu n’as rien avancé. Si le client n’y va pas, tu ne perds rien non plus.
        </p>
        <button onClick={() => { setFini(null); setAppel(null); setTexte(''); setChoix(null); }}
          className="mt-4 w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold">
          Un autre client
        </button>
      </Section>
    );
  }

  return (
    <div className="space-y-3">
      <Section n="1" titre="Qu’est-ce qu’il cherche ?" actif={!appel} fait={!!appel}>
        <div className="flex gap-2">
          <input value={texte} onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && chercher()}
            placeholder="Timberland 45, botte homme…"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900" />
          <button onClick={chercher} disabled={!texte.trim()}
            className="bg-gray-900 text-white rounded-xl px-4 text-sm font-semibold disabled:opacity-40">
            Chercher
          </button>
        </div>

        {res && (
          <div className="mt-3 space-y-2">
            {/* Son stock d'abord. C'est son métier, et il récupère les deux
                tiers des ruptures tout seul. */}
            {res.filter((r) => r.source === 'moi').length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Chez toi</p>
                {res.filter((r) => r.source === 'moi').map((r) => (
                  <div key={r.product_id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                    <p className="text-sm font-semibold text-emerald-900">{r.nom}</p>
                    <p className="text-[12px] text-emerald-700">Tu l’as — vends-le, pas besoin de relais.</p>
                  </div>
                ))}
              </>
            )}
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-1">
              Si tu ne peux pas le servir
            </p>
            <button onClick={() => appeler(res.find((r) => r.source === 'rayon') || null)}
              className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold">
              Demander au rayon · 30 secondes
            </button>
          </div>
        )}
      </Section>

      {appel && (
        <Section n="2" titre="Le rayon répond" actif={!choix} fait={!!choix}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] text-gray-500">
              {appel.interroges} boutique{appel.interroges > 1 ? 's' : ''} interrogée
              {appel.interroges > 1 ? 's' : ''} · appel {appel.forme === 'ferme' ? 'sur fiche' : 'ouvert'}
            </p>
            <span className={`text-lg font-bold tabular-nums ${reste ? 'text-gray-900' : 'text-gray-300'}`}>
              {reste}s
            </span>
          </div>

          {rangs.length === 0 && reste > 0 && (
            <p className="text-sm text-gray-400">En attente des réponses…</p>
          )}
          {rangs.length === 0 && reste === 0 && (
            <p className="text-sm text-gray-500">
              Personne n’a répondu à temps. Le client repart, et la demande est
              enregistrée au journal.
            </p>
          )}

          <div className="space-y-2">
            {rangs.map((r) => {
              const d = decomposer(r.prix_net);
              const sel = choix?.vendor_id === r.vendor_id;
              return (
                <button key={r.vendor_id} onClick={() => setChoix(r)}
                  className={`w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${
                    sel ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {r.rang === 1 && <span className="text-emerald-600 mr-1">★</span>}
                        {r.shop_name}
                      </p>
                      <p className="text-[12px] text-gray-500">
                        {r.distance_m != null ? `${r.distance_m} m · ` : ''}
                        a envoyé {r.envoyes_30j}, reçu {r.recus_30j}
                      </p>
                      {r.rang === 1 && (
                        <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          {r.sous_plancher ? 'Sous son minimum du mois' : 'C’est elle qui a le plus donné'}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fcfa(d.affiche)}</p>
                      <p className="text-[11px] text-emerald-700">+ {fcfa(d.bon)} pour toi</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Il peut s'écarter du classement, mais il doit dire pourquoi : c'est
              le seul endroit où le renvoi entre amis laisse une trace. */}
          {choix && choix.rang > 1 && (
            <div className="mt-3">
              <p className="text-[12px] text-gray-500 mb-1.5">
                Ce n’est pas celle que le rayon propose. Pourquoi ?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOTIFS.map(([k, l]) => (
                  <button key={k} onClick={() => setMotif(k)}
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] font-medium ${
                      motif === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {choix && rayon?.genre === 'service' && (
        <Section n="3" titre="Le client se déplace, ou on lui apporte ?" actif>
          <div className="grid grid-cols-2 gap-2">
            {[['marche', 'Il y va à pied', `${choix.distance_m ?? '—'} m`],
              ['livre',  'On lui apporte', 'il est immobilisé chez toi']].map(([k, l, d]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`text-left rounded-xl border px-3.5 py-3 transition-colors ${
                  mode === k ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                <p className="text-sm font-bold text-gray-900">{l}</p>
                <p className="text-[12px] text-gray-500">{d}</p>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-gray-500 mt-2.5 leading-relaxed">
            Ta cliente est dans le fauteuil et ne peut pas se lever : la boutique
            qui vend te l’apporte. Elle paie elle-même dans l’application — tu
            n’avances rien et tu ne revends rien.
          </p>
        </Section>
      )}

      {choix && (
        <Section n={rayon?.genre === 'service' ? '4' : '3'} titre="Identifie le client" actif>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            Dis-lui de scanner l’affiche sur ton comptoir. Il aura son compte et
            son code en deux gestes, sans rien installer.
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ou tape son code : ABC234" maxLength={6}
            className="mt-3 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm tracking-widest outline-none focus:border-gray-900" />
          <button onClick={attribuer}
            disabled={choix.rang > 1 && !motif}
            className="mt-3 w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40">
            Envoyer chez {choix.shop_name}
          </button>
        </Section>
      )}

      {msg && <p className="text-[13px] text-gray-600 px-1">{msg}</p>}
    </div>
  );
}

/* ── RECEVOIR ────────────────────────────────────────────────────────────── */

function Recevoir({ vendor }) {
  const [code, setCode] = useState('');
  const [trouve, setTrouve] = useState(null);
  const [msg, setMsg] = useState('');

  const valider = async () => {
    setMsg('');
    const { data, error } = await validerCode(code, vendor.id);
    if (error) { setMsg(error.message); setTrouve(null); return; }
    setTrouve(data?.[0] || null);
  };

  const rupture = async () => {
    const { error } = await declarerRupture(trouve.relais_id, vendor.id);
    setMsg(error ? error.message
                 : 'Noté. Le client est renvoyé vers la boutique suivante depuis où il est.');
    setTrouve(null); setCode('');
  };

  return (
    <div className="space-y-3">
      <Section n="1" titre="Le code du client" actif={!trouve} fait={!!trouve}>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && valider()}
            placeholder="ABC234" maxLength={6}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold tracking-[0.3em] text-center outline-none focus:border-gray-900" />
          <button onClick={valider} disabled={code.length < 6}
            className="bg-gray-900 text-white rounded-xl px-5 text-sm font-semibold disabled:opacity-40">
            Valider
          </button>
        </div>
      </Section>

      {trouve && (
        <Section n="2" titre="Ce qu’il vient chercher" actif>
          <p className="text-sm font-bold text-gray-900">{trouve.libelle}</p>
          <div className="mt-3 space-y-1 text-[13px]">
            <div className="flex justify-between"><span className="text-gray-500">Prix affiché</span><span>{fcfa(trouve.prix_affiche)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Son bon</span><span className="text-emerald-700">− {fcfa(trouve.remise)}</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-1 mt-1 font-bold">
              <span>Il paie</span><span>{fcfa(trouve.prix_paye)}</span>
            </div>
          </div>
          <p className="text-[12px] text-emerald-700 mt-3 leading-relaxed">
            Tu touches ton prix net en entier. On ne prend rien sur ce client —
            il paie dans l’application, et ton solde est crédité dès qu’il
            confirme avoir l’article.
          </p>
          <button onClick={rupture}
            className="mt-4 w-full border border-gray-200 text-gray-600 rounded-xl py-2.5 text-[13px] font-semibold">
            Je ne l’ai plus
          </button>
        </Section>
      )}

      {msg && <p className="text-[13px] text-gray-600 px-1">{msg}</p>}
    </div>
  );
}

/* ── À LIVRER ────────────────────────────────────────────────────────────────
   Le second type de relais. Une cliente est assise dans un fauteuil, à moitié
   coiffée, et il manque une longueur de mèche. Elle ne peut pas se lever et
   marcher deux cents mètres.

   Le salon lance donc le relais en cochant « on lui apporte », et c'est la
   boutique qui vend qui porte — jamais l'envoyeur, qui ne quitte pas son
   comptoir. La cliente achète en direct : si le salon payait et refacturait,
   il deviendrait revendeur et tout le modèle du prix net s'effondrerait.
   ──────────────────────────────────────────────────────────────────────────── */

function ALivrer({ vendor }) {
  const [lignes, setLignes] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const recharger = () =>
    relaisALivrer(vendor.id).then(({ data, error }) => {
      if (error) setMsg(error.message);
      setLignes(data || []);
    });

  useEffect(() => { recharger(); }, [vendor.id]);

  const remettre = async (id) => {
    setBusy(id); setMsg('');
    const { error } = await confirmerRemise(id);
    setBusy('');
    if (error) { setMsg(error.message); return; }
    recharger();
  };

  if (!lignes.length) {
    return (
      <div className="rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500 leading-relaxed">
          Rien à livrer. Ces demandes viennent des salons, couturiers et garages
          du rayon : leur client est immobilisé et ne peut pas se déplacer.
        </p>
        {msg && <p className="text-[13px] text-gray-600 mt-2">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[13px] text-amber-900 leading-relaxed">
          <b>Le client attend, immobilisé.</b> Au-delà de vingt minutes il n’aura
          plus besoin de l’article — pars maintenant, ou dis que tu ne l’as plus.
        </p>
      </div>

      {lignes.map((l) => (
        <div key={l.id} className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{l.libelle}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Pour {l.emetteur?.shop_name || 'une boutique du rayon'}
                {l.distance_m != null && ` · ${l.distance_m} m`}
              </p>
              {l.emetteur?.pickup_label && (
                <p className="text-[12px] text-gray-500">{l.emetteur.pickup_label}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{fcfa(l.prix_net)}</p>
              <p className="text-[11px] text-gray-500">ton prix net</p>
            </div>
          </div>

          {/* Trois états, trois gestes. On ne montre jamais deux boutons à la fois :
              le porteur est dans la rue, sur un téléphone, avec une main prise. */}
          {l.etat === 'attribue' && (
            <div className="mt-3 rounded-xl bg-gray-50 px-3.5 py-2.5">
              <p className="text-[12px] text-gray-600">
                Prends l’article et porte-le. Sur place, le client te montre son
                code <b className="tracking-widest">{l.code}</b> — tu le valides
                dans l’onglet « Un client arrive ».
              </p>
            </div>
          )}
          {l.etat === 'arrive' && (
            <div className="mt-3 rounded-xl bg-blue-50 px-3.5 py-2.5">
              <p className="text-[12px] text-blue-800">
                Code validé. Le client paie {fcfa(l.prix_paye)} dans l’application —
                attends la confirmation avant de laisser l’article.
              </p>
            </div>
          )}
          {l.etat === 'paye' && (
            <button onClick={() => remettre(l.id)} disabled={busy === l.id}
              className="mt-3 w-full bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40">
              {busy === l.id ? '…' : 'Je lui ai remis l’article'}
            </button>
          )}
        </div>
      ))}

      {msg && <p className="text-[13px] text-gray-600 px-1">{msg}</p>}
    </div>
  );
}

/* ── JOURNAL ─────────────────────────────────────────────────────────────── */

const ETIQUETTE = {
  attribue: ['En route',   'bg-blue-50 text-blue-700'],
  arrive:   ['Arrivé',     'bg-amber-50 text-amber-700'],
  paye:     ['Payé',       'bg-emerald-50 text-emerald-700'],
  remis:    ['Terminé',    'bg-emerald-50 text-emerald-700'],
  expire:   ['Pas venu',   'bg-gray-100 text-gray-500'],
  rupture:  ['Rupture',    'bg-red-50 text-red-600'],
  annule:   ['Sans achat', 'bg-gray-100 text-gray-500'],
};

function Journal({ vendor }) {
  const [lignes, setLignes] = useState([]);
  const [bon, setBon] = useState(null);

  useEffect(() => {
    relaisDuComptoir(vendor.id).then(({ data }) => setLignes(data || []));
    soldeBon(vendor.id).then(({ data }) => setBon(data?.[0] || null));
  }, [vendor.id]);

  return (
    <div className="space-y-3">
      {bon && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Ton bon</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{fcfa(bon.solde)}</p>
          <p className="text-[12px] text-emerald-800 mt-1">
            {fcfa(bon.gagne_30j)} gagnés ce mois-ci · {fcfa(bon.retirable)} retirables
          </p>
          <p className="text-[12px] text-emerald-700 mt-2 leading-relaxed">
            Sers-t’en pour faire des remises à tes propres clients quand tu veux,
            pour payer ton abonnement si tu le décides, ou retire-le après trente jours.
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {lignes.length === 0 && (
          <p className="p-5 text-sm text-gray-400 text-center">Aucun relais pour l’instant.</p>
        )}
        {lignes.map((l) => {
          const [txt, cls] = ETIQUETTE[l.etat] || ['—', 'bg-gray-100 text-gray-500'];
          return (
            <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{l.libelle}</p>
                <p className="text-[12px] text-gray-500">
                  {l.sens === 'envoye' ? 'envoyé chez' : 'reçu de'} {l.autre_boutique}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{txt}</span>
                {l.sens === 'envoye' && l.etat === 'remis' && (
                  <p className="text-[12px] text-emerald-700 font-semibold mt-1">+ {fcfa(l.bon)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
