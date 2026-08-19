import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DeliveryMap from '../components/DeliveryMap';
import { monRelais, payerRelais, confirmerRemise, annulerRelais,
         maPresence, signalerPresence, boutiqueParCode,
         resteAvant, etapes, fcfa } from '../lib/relais';

/* ══════════════════════════════════════════════════════════════════════════
   MON RELAIS — l'écran du client

   Il n'a pas l'application, il ne connaissait pas Buyticle il y a trois
   minutes, et on lui demande de traverser un marché. Tout ce qui suit sert à
   ce qu'il s'y mette.

   L'ARTICLE SE VOIT. On lui montrait un nom et un prix. On ne fait pas marcher
   quelqu'un pour une ligne de texte : la photo est la première chose à
   l'écran, avant le prix, avant le chemin.

   LE CHEMIN EST DANS LA PAGE. Renvoyer vers une carte extérieure, c'était
   sortir le client de la plateforme au seul moment où il est décidé — et sur
   un téléphone d'occasion, l'application de cartes met dix secondes à ouvrir,
   parfois ne revient jamais.

   L'avis n'est jamais demandé ici : il arrive par notification quelques heures
   plus tard, sur une commande livrée. Écrire un avis au comptoir, sous le
   regard du commerçant, ne produit pas un avis — ça produit une politesse.
   ══════════════════════════════════════════════════════════════════════════ */

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
       <rect width="200" height="200" fill="#F3F4F6"/>
       <path d="M60 130h80M70 105l22-26 18 21 12-13 18 18" stroke="#C7CBD1"
             stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     </svg>`);

/* ── LE CHEMIN, DANS LA PAGE ─────────────────────────────────────────────────
   Deux points et le trait entre eux. On ne prétend pas donner un itinéraire
   rue par rue — dans un marché il n'y a pas de rues, il y a des allées, et
   aucun service de routage ne les connaît. Ce que le client a besoin de
   savoir, c'est la direction et la distance ; le reste, il le fait à l'œil,
   comme il le fait tous les jours.

   Sa position réelle s'ajoute s'il l'autorise. On ne la demande jamais
   d'office : une demande de géolocalisation non sollicitée, sur cet écran-là,
   se refuse et se retient.
   ──────────────────────────────────────────────────────────────────────────── */

function Chemin({ r }) {
  const [moi, setMoi] = useState(null);
  const [refus, setRefus] = useState('');

  const dest    = Number.isFinite(r.lat) && Number.isFinite(r.lng) ? { lat: r.lat, lng: r.lng } : null;
  const depart  = Number.isFinite(r.depart_lat) && Number.isFinite(r.depart_lng)
    ? { lat: r.depart_lat, lng: r.depart_lng } : null;

  const marqueurs = useMemo(() => {
    const m = [];
    if (depart) m.push({ id: 'depart', lat: depart.lat, lng: depart.lng,
                         color: '#6B7280', icon: 'fa-store', label: r.depart_nom || 'Départ' });
    if (dest)   m.push({ id: 'dest', lat: dest.lat, lng: dest.lng,
                         color: '#059669', icon: 'fa-flag-checkered', label: r.boutique });
    if (moi)    m.push({ id: 'moi', lat: moi.lat, lng: moi.lng,
                         color: '#2563EB', icon: 'fa-location-dot', label: 'Toi' });
    return m;
  }, [depart, dest, moi, r.boutique, r.depart_nom]);

  const trace = useMemo(() => {
    const a = moi || depart;
    if (!a || !dest) return null;
    return [[a.lat, a.lng], [dest.lat, dest.lng]];
  }, [moi, depart, dest]);

  const localiser = () => {
    if (!navigator.geolocation) { setRefus('Ton téléphone ne donne pas la position.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setMoi({ lat: p.coords.latitude, lng: p.coords.longitude }); setRefus(''); },
      () => setRefus('Position refusée — le chemin part de la boutique.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (!dest) {
    // Pas de coordonnées : on ne montre pas une carte vide, on montre le repère.
    return (
      <ol className="space-y-3">
        {etapes(r).map((e, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[#0F1111] text-white grid place-items-center text-[11px] font-bold shrink-0">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F1111]">{e.t}</p>
              {e.s && <p className="text-[12px] text-[#565959]">{e.s}</p>}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div>
      <div className="rounded-lg overflow-hidden border border-[#D5D9D9]">
        <DeliveryMap
          markers={marqueurs}
          route={trace}
          center={dest}
          zoom={16}
          routeColor="#059669"
          className="w-full h-[260px] sm:h-[320px] lg:h-[380px]"
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button onClick={localiser}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-[#F7FAFA] border border-[#D5D9D9] rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#0F1111] shadow-[0_2px_5px_rgba(213,217,217,.5)] transition">
          <i className="fa-solid fa-location-crosshairs text-[11px]" />
          {moi ? 'Recentrer sur moi' : 'Où suis-je ?'}
        </button>
        {r.distance_m != null && (
          <span className="text-[12px] text-[#565959]">
            À peu près <b className="text-[#0F1111]">{r.distance_m} m</b> à pied
          </span>
        )}
      </div>
      {refus && <p className="text-[12px] text-[#565959] mt-1.5">{refus}</p>}

      <ol className="mt-4 space-y-2.5 border-t border-[#E7E7E7] pt-3.5">
        {etapes(r).map((e, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-[#0F1111] text-white grid place-items-center text-[10px] font-bold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[#0F1111]">{e.t}</p>
              {e.s && <p className="text-[12px] text-[#565959]">{e.s}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── JE SUIS DANS UNE BOUTIQUE ───────────────────────────────────────────────
   Le second chemin vers la présence, à côté du scan.

   Il fallait le prévoir dès le départ : le scan ne marche pas toujours. Un
   téléphone d'occasion n'ouvre pas les liens depuis l'appareil photo, une
   affiche décollée ne se lit plus, et surtout — le cas qu'on avait manqué —
   un client qui a déjà un compte et qui est déjà connecté n'a aucune raison
   de repasser par /r/<code>. Il ouvre l'application et cherche le bouton.

   Le nom de la boutique s'affiche dès que le code est complet, avant de
   valider. Se signaler chez le mauvais commerçant enverrait le relais d'un
   autre client sur son téléphone.
   ──────────────────────────────────────────────────────────────────────────── */

function JeSuisEnBoutique({ onSignale }) {
  const [ouvert, setOuvert] = useState(false);
  const [code, setCode]     = useState('');
  const [boutique, setBout] = useState(null);
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState('');

  // Dès que le code a sa longueur, on va chercher le nom. Une frappe de plus
  // annule la précédente : sinon deux réponses lentes peuvent arriver dans le
  // désordre et afficher le nom d'une boutique qu'il n'a plus à l'écran.
  useEffect(() => {
    const c = code.trim();
    if (c.length < 4) { setBout(null); return; }
    let vivant = true;
    boutiqueParCode(c).then(({ data }) => { if (vivant) setBout(data?.[0] || null); });
    return () => { vivant = false; };
  }, [code]);

  const valider = async () => {
    setBusy(true); setMsg('');
    const { error } = await signalerPresence(code.trim());
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onSignale();
  };

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)}
        className="w-full bg-white border border-[#D5D9D9] rounded-lg px-5 py-4 text-left hover:bg-[#F7FAFA] transition shadow-[0_2px_5px_rgba(213,217,217,.5)]">
        <p className="text-[15px] font-bold text-[#0F1111] flex items-center gap-2">
          <i className="fa-solid fa-shop text-[#007185]" />
          Je suis dans une boutique
        </p>
        <p className="text-[13px] text-[#565959] mt-1 leading-relaxed">
          Le vendeur n’a pas ton article ? Tape le code de son comptoir pour
          qu’il puisse t’envoyer chez un voisin qui l’a.
        </p>
      </button>
    );
  }

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-lg p-5 shadow-[0_2px_5px_rgba(213,217,217,.5)]">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#565959]">
        Le code affiché sur le comptoir
      </p>
      <input value={code} autoFocus
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && boutique && valider()}
        placeholder="ABC123" maxLength={12}
        className="mt-2 w-full bg-[#F7FAFA] border border-[#D5D9D9] rounded-lg px-4 py-3.5 text-center text-2xl font-black tracking-[0.2em] outline-none focus:border-[#0F1111]" />

      {boutique && (
        <p className="text-[13px] text-[#007600] font-semibold text-center mt-2.5">
          {boutique.boutique}
        </p>
      )}
      {code.trim().length >= 4 && !boutique && (
        <p className="text-[12px] text-[#565959] text-center mt-2.5">
          Aucune boutique avec ce code — vérifie l’affiche.
        </p>
      )}

      <button onClick={valider} disabled={busy || !boutique}
        className="mt-3 w-full bg-[#FFD814] hover:bg-[#F7CA00] rounded-full py-3 text-[14px] font-bold text-[#0F1111] disabled:opacity-40 transition">
        {busy ? '…' : 'Je suis ici'}
      </button>
      <button onClick={() => { setOuvert(false); setCode(''); setMsg(''); }}
        className="mt-2 w-full text-[13px] text-[#007185] hover:text-[#C7511F] py-1.5">
        Annuler
      </button>

      {msg && <p className="text-[13px] text-[#B12704] text-center mt-2">{msg}</p>}
    </div>
  );
}

/* ── L'ÉCRAN ─────────────────────────────────────────────────────────────── */

/* Ces deux-là vivent hors du composant. Défini à l'intérieur, `Argent` serait
   un type neuf à chaque rendu — et comme le compte à rebours redessine la page
   toutes les secondes, React démonterait puis remonterait le bloc de paiement
   une fois par seconde, bouton compris. */

const Page = ({ children }) => (
  <div className="min-h-screen bg-[#E3E6E6] p-2 md:p-3">
    <div className="max-w-[1500px] mx-auto">{children}</div>
  </div>
);

function Argent({ r, reste, msg, compact, onPayer, onConfirmer, onAnnuler }) {
  const livre = r.mode === 'livre';
  return (
    <div className={`bg-white rounded-lg ${compact ? 'p-4' : 'p-5'}`}>
      <div className="space-y-1.5 text-[14px]">
        <div className="flex justify-between text-[#565959]">
          <span>Prix affiché</span>
          <span className="line-through">{fcfa(r.prix_affiche)}</span>
        </div>
        <div className="flex justify-between text-[#007600] font-semibold">
          <span>Ta remise</span><span>− {fcfa(r.remise)}</span>
        </div>
        <div className="flex justify-between items-baseline border-t border-[#E7E7E7] pt-2.5 mt-2.5">
          <span className="text-[15px] text-[#0F1111]">Tu paies</span>
          <span className="text-[22px] font-bold text-[#B12704]">{fcfa(r.prix_paye)}</span>
        </div>
      </div>

      {reste && (
        <p className="text-[12px] text-[#565959] mt-3 leading-relaxed">
          Valable encore <b className="text-[#0F1111]">{reste}</b>, et seulement chez {r.boutique}.
        </p>
      )}

      {r.etat === 'arrive' && (
        <button onClick={onPayer}
          className="mt-3.5 w-full bg-[#FFD814] hover:bg-[#F7CA00] rounded-full py-3 text-[14px] font-bold text-[#0F1111] transition">
          Payer {fcfa(r.prix_paye)}
        </button>
      )}

      {r.etat === 'paye' && (
        <>
          <button onClick={onConfirmer}
            className="mt-3.5 w-full bg-[#007600] hover:bg-[#006400] text-white rounded-full py-3 text-[14px] font-bold transition">
            J’ai mon article
          </button>
          <p className="text-[12px] text-[#565959] text-center mt-2 leading-relaxed">
            {livre
              ? 'La boutique peut aussi confirmer de son côté. Ne le fais qu’avec l’article en main.'
              : 'Ne confirme qu’une fois l’article en main.'}
          </p>
        </>
      )}

      {r.etat === 'attribue' && (
        <button onClick={onAnnuler}
          className="mt-3 w-full text-[13px] text-[#007185] hover:text-[#C7511F] py-2">
          {livre ? 'Finalement, je n’en veux pas' : 'Finalement, je n’y vais pas'}
        </button>
      )}

      {msg && <p className="text-[13px] text-[#B12704] text-center mt-3">{msg}</p>}
    </div>
  );
}

export default function RelaisPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [r, setR]       = useState(null);
  const [presence, setPresence] = useState(null);
  const [charge, setCharge] = useState(true);
  const [msg, setMsg]   = useState('');
  const [reste, setReste] = useState(null);

  const recharger = async () => {
    const { data, error } = await monRelais();
    if (error) setMsg(error.message);
    const rel = data?.[0] || null;
    setR(rel);
    // Pas encore de relais : il vient peut-être de scanner un comptoir et
    // attend que le vendeur l'attache. Son code doit être à l'écran, pas
    // caché derrière un « aucun relais en cours ».
    if (!rel) {
      const { data: p } = await maPresence();
      setPresence(p?.[0] || null);
    } else {
      setPresence(null);
    }
    setCharge(false);
  };

  useEffect(() => { if (user) recharger(); else setCharge(false); }, [user]);

  // Tant qu'il attend, on regarde toutes les trois secondes si le vendeur a
  // attaché le relais. Il est debout devant le comptoir : il ne va pas
  // recharger la page lui-même.
  useEffect(() => {
    if (!user || r) return;
    const t = setInterval(recharger, 3000);
    return () => clearInterval(t);
  }, [user, r]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!r?.expire_le) return;
    const t = setInterval(() => setReste(resteAvant(r.expire_le)), 1000);
    setReste(resteAvant(r.expire_le));
    return () => clearInterval(t);
  }, [r?.expire_le]);

  if (charge) {
    return (
      <Page>
        <div className="bg-white rounded-lg p-16 text-center text-[#565959]">…</div>
      </Page>
    );
  }

  if (!user) {
    return (
      <Page>
        <div className="bg-white rounded-lg p-10 sm:p-16 text-center max-w-md mx-auto">
          <p className="text-[15px] text-[#0F1111] mb-4">Connecte-toi pour voir ton relais.</p>
          <button onClick={() => navigate('/login')}
            className="bg-[#FFD814] hover:bg-[#F7CA00] rounded-full px-8 py-2.5 text-[14px] font-bold text-[#0F1111] transition">
            Se connecter
          </button>
        </div>
      </Page>
    );
  }

  // Il a scanné un comptoir et le vendeur n'a pas encore attaché le relais.
  // C'est le seul moment où son code de présence sert, et il doit être énorme.
  if (!r && presence) {
    return (
      <Page>
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg border-2 border-[#0F1111] p-6 sm:p-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#565959]">
              Montre ce code au vendeur
            </p>
            <p className="text-5xl sm:text-6xl font-black tracking-[0.2em] text-[#0F1111] mt-3 break-all">
              {presence.code}
            </p>
            <p className="text-[14px] text-[#565959] mt-3 leading-relaxed">
              Tu es chez <b className="text-[#0F1111]">{presence.boutique}</b>. Le vendeur le
              saisit, et ton article, ton prix et ton chemin s’afficheront ici.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[#565959]">
            <span className="w-2 h-2 rounded-full bg-[#007600] animate-pulse" />
            En attente du vendeur
          </div>
          <p className="text-[12px] text-[#565959] text-center mt-4">
            Ce code est valable quinze minutes. S’il expire, rescanne l’affiche
            du comptoir.
          </p>
        </div>
      </Page>
    );
  }

  if (!r) {
    return (
      <Page>
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Le geste d'abord, l'explication ensuite. Celui qui arrive ici est
              presque toujours debout dans une boutique, en train de chercher
              comment se signaler — pas en train de se demander ce qu'est un
              relais. C'est précisément ce chemin qui manquait : un client déjà
              inscrit et déjà connecté n'avait aucun moyen de se déclarer, et
              le vendeur ne pouvait donc rattacher personne. */}
          <JeSuisEnBoutique onSignale={recharger} />

          <div className="bg-white rounded-lg p-6 sm:p-8 text-center">
            <p className="text-[17px] font-bold text-[#0F1111]">Aucun relais en cours</p>
            <p className="text-[14px] text-[#565959] mt-2 leading-relaxed max-w-md mx-auto">
              Quand un commerçant n’a pas ce que tu cherches, il t’envoie chez un
              voisin qui l’a — et tu obtiens une remise.
            </p>
          </div>

          <div className="bg-white rounded-lg p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#565959]">
              Comment ça marche
            </p>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2">
              {['Le commerçant n’a pas ce que tu cherches et te le dit.',
                'Tu scannes l’affiche Buyticle de son comptoir — ou tu tapes son code ci-dessus.',
                'Un code à quatre caractères apparaît ici. Tu le lui montres.',
                'Ton article, ta remise et ton chemin s’affichent. Tu y vas.'].map((t, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0F1111] text-white grid place-items-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[13px] text-[#565959] leading-relaxed">{t}</span>
                </li>
              ))}
            </ol>
          </div>

          <button onClick={() => navigate('/store')}
            className="w-full bg-white hover:bg-[#F7FAFA] border border-[#D5D9D9] rounded-lg py-3.5 text-[14px] font-semibold text-[#0F1111] shadow-[0_2px_5px_rgba(213,217,217,.5)] transition">
            Voir la boutique
          </button>
        </div>
      </Page>
    );
  }

  const payer = async () => {
    setMsg('');
    const { error } = await payerRelais(r.id);
    if (error) { setMsg(error.message); return; }
    recharger();
  };

  const confirmer = async () => {
    setMsg('');
    const { error } = await confirmerRemise(r.id);
    if (error) { setMsg(error.message); return; }
    setR(null);
    navigate('/profile');
  };

  const livre = r.mode === 'livre';

  /* Le bloc argent + action : en colonne de droite sur grand écran, répété en
     bas sur téléphone — c'est le seul élément qu'on ne peut pas laisser hors
     de portée du pouce. */
  const argent = (compact) => (
    <Argent r={r} reste={reste} msg={msg} compact={compact}
      onPayer={payer} onConfirmer={confirmer}
      onAnnuler={() => annulerRelais(r.id).then(recharger)} />
  );

  return (
    <Page>
      <div className="flex flex-col lg:flex-row gap-2 md:gap-3 items-start">

        {/* ═══ COLONNE PRINCIPALE ══════════════════════════════════════════ */}
        <div className="w-full lg:flex-1 min-w-0 space-y-2 md:space-y-3">

          {/* L'article. La photo d'abord : c'est elle qui fait marcher. */}
          <div className="bg-white rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
              <div className="w-full sm:w-[200px] lg:w-[240px] shrink-0 h-[200px] sm:h-[200px] lg:h-[240px] bg-white flex items-center justify-center">
                <img src={r.img || PLACEHOLDER} alt={r.libelle}
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                  className="max-w-full max-h-full object-contain mix-blend-multiply" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#565959]">
                  {livre ? 'On te l’apporte' : 'Ce que tu vas chercher'}
                </p>
                <h1 className="text-[20px] sm:text-[24px] font-bold text-[#0F1111] mt-1 leading-tight break-words">
                  {r.libelle}
                </h1>
                <p className="text-[13px] text-[#565959] mt-2">
                  Chez <b className="text-[#0F1111]">{r.boutique}</b>
                  {r.repere ? ` · ${r.repere}` : ''}
                </p>
                {r.envoye_par && (
                  <p className="text-[12px] text-[#565959] mt-1">
                    Envoyé par {r.envoye_par}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-baseline gap-2">
                  <span className="text-[26px] font-bold text-[#B12704]">{fcfa(r.prix_paye)}</span>
                  <span className="text-[14px] text-[#565959] line-through">{fcfa(r.prix_affiche)}</span>
                  <span className="text-[12px] font-bold text-[#007600] bg-[#F0F9F0] border border-[#C6E6C6] rounded px-2 py-0.5">
                    − {fcfa(r.remise)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Le chemin, dans la page. */}
          {r.etat === 'attribue' && (
            <div className="bg-white rounded-lg p-4 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#565959] mb-3">
                {livre ? 'On te l’apporte' : 'Ton chemin'}
              </p>
              {livre ? (
                <p className="text-[14px] text-[#0F1111] leading-relaxed">
                  {r.boutique} te livre sur place. Tu ne paies qu’à la remise, et si
                  l’article ne te convient pas tu n’es pas débité.
                </p>
              ) : (
                <Chemin r={r} />
              )}
            </div>
          )}

          {/* Le code, en très grand : il se lit à voix haute dans une allée
              bruyante. */}
          <div className="bg-white rounded-lg p-5 sm:p-6 text-center border-2 border-dashed border-[#D5D9D9]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#565959]">
              {livre ? 'Montre ce code à celui qui apporte' : 'Montre ce code au comptoir'}
            </p>
            <p className="text-[34px] sm:text-[44px] font-black tracking-[0.22em] text-[#0F1111] mt-2 break-all">
              {r.code}
            </p>
            <p className="text-[12px] text-[#565959] mt-2 leading-relaxed max-w-sm mx-auto">
              {livre
                ? `Seul ${r.boutique} peut l’honorer. Ne paie qu’une fois l’article devant toi.`
                : `Il ne marche que chez ${r.boutique}. Personne d’autre ne peut l’honorer.`}
            </p>
          </div>

          {/* Sur téléphone, l'argent revient sous le code : le pouce est là. */}
          <div className="lg:hidden">
            {argent(true)}
          </div>
        </div>

        {/* ═══ RAIL DROIT — l'argent et l'action, toujours visibles ════════ */}
        <aside className="hidden lg:block w-[300px] xl:w-[340px] flex-shrink-0 lg:sticky lg:top-3">
          {argent(false)}
        </aside>
      </div>
    </Page>
  );
}
