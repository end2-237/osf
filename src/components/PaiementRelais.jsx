import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { payerRelais, renoncerAuComptoir, etatCommandes, pousserUssd,
         mettreAuPanier, OPERATEURS, fcfa } from '../lib/relais';

/* ══════════════════════════════════════════════════════════════════════════
   PAYER SON RELAIS

   L'argent passe par la plateforme, sinon il n'y a pas de modèle : la
   commission de 3 %, le bon de 5 % de l'envoyeur et le prix net du receveur
   sortent tous les trois d'un encaissement. Un « c'est payé » déclaré au
   comptoir ne finance rien et ne se vérifie pas.

   C'est le circuit du panier, sans une ligne d'écart : commande en attente,
   poussée USSD par `monetbil-init`, et le webhook de l'opérateur qui tranche.
   L'écran ne décide jamais qu'un paiement a eu lieu — il attend et regarde.

   ET S'IL NE PAIE PAS, L'ARTICLE NE SE PERD PAS. Il part dans son panier.
   Un client qui n'a pas le solde aujourd'hui n'est pas un client perdu ; le
   faire repartir les mains vides avec l'article effacé de son téléphone, si.
   ══════════════════════════════════════════════════════════════════════════ */

const DELAI = 8 * 60 * 1000;   // au-delà, on cesse d'attendre et on lui rend la main

export default function PaiementRelais({ r, onFini }) {
  const [phase, setPhase]   = useState('choix');   // choix · attente · echec · panier
  const [moyen, setMoyen]   = useState('orange_money');
  const [tel, setTel]       = useState('');
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState('');
  const [orderId, setOrder] = useState(null);
  const [lien, setLien]     = useState('');
  const timer = useRef(null);

  // On attend le webhook, pas le client. Il paie sur l'écran de son opérateur,
  // souvent en quittant le navigateur — le relais avance côté base de toute
  // façon, ce sondage ne sert qu'à rafraîchir ce qu'il a sous les yeux.
  useEffect(() => {
    if (phase !== 'attente' || !orderId) return;
    const debut = Date.now();

    const voir = async () => {
      if (Date.now() - debut > DELAI) {
        clearInterval(timer.current);
        setPhase('echec');
        setMsg('Délai dépassé. Vérifie ton téléphone, ou reprends plus tard.');
        return;
      }
      try {
        const { data } = await etatCommandes([orderId]);
        const etat = data?.[0]?.status;
        if (etat === 'paid') {
          clearInterval(timer.current);
          onFini();
        } else if (etat === 'payment_failed' || etat === 'cancelled') {
          clearInterval(timer.current);
          setPhase('echec');
          setMsg('Paiement refusé ou annulé. Vérifie ton solde et réessaie.');
        }
      } catch { /* coupure réseau — on continue de regarder */ }
    };

    timer.current = setInterval(voir, 5000);
    return () => clearInterval(timer.current);
  }, [phase, orderId]);   // eslint-disable-line react-hooks/exhaustive-deps

  const payer = async () => {
    const num = tel.replace(/\D/g, '');
    if (num.length < 9) { setMsg('Entre le numéro qui va payer, à 9 chiffres.'); return; }
    setBusy(true); setMsg('');

    const { data, error } = await payerRelais(r.id, moyen);
    if (error) { setBusy(false); setMsg(error.message); return; }
    const oid = data?.[0]?.order_id;
    if (!oid) { setBusy(false); setMsg('La commande n’a pas pu être créée.'); return; }
    setOrder(oid);

    try {
      const out = await pousserUssd({ orderId: oid, montant: r.prix_paye, tel: num, moyen });
      setLien(out.payment_url || '');
      setPhase('attente');
      // Certains opérateurs ne poussent pas d'USSD et renvoient une page. On ne
      // l'ouvre qu'après avoir vérifié le domaine : cette adresse vient du
      // réseau, et elle va recevoir un numéro de téléphone.
      if (out.payment_url) {
        try {
          const u = new URL(out.payment_url);
          if (u.hostname.endsWith('monetbil.com') || u.hostname.endsWith('monetbil.net')) {
            window.open(out.payment_url, '_blank');
          }
        } catch { /* adresse illisible — on reste sur l'attente USSD */ }
      }
    } catch (e) {
      setPhase('echec');
      setMsg(e.message || 'Le paiement n’a pas pu démarrer.');
    } finally {
      setBusy(false);
    }
  };

  /* Il renonce. On ne le laisse pas repartir les mains vides : l'article
     retourne dans son panier, au prix du catalogue. La remise du relais
     payait le déplacement au comptoir — sans déplacement, elle n'a plus
     d'objet, et le bon de l'envoyeur ne naîtra jamais. */
  const versLePanier = async () => {
    setBusy(true); setMsg('');

    if (!r.product_id) {
      // Appel ouvert : le vendeur a saisi l'article à la volée, il n'est dans
      // aucun catalogue. On ne peut pas le mettre au panier — mais on peut
      // libérer le relais honnêtement plutôt que de faire semblant.
      await renoncerAuComptoir(r.id);
      setBusy(false);
      onFini();
      return;
    }

    const { data: p } = await supabase
      .from('products')
      .select('id, name, price, img, vendor_id, type, status')
      .eq('id', r.product_id)
      .maybeSingle();

    if (p) {
      mettreAuPanier({
        id: p.id, name: p.name, price: p.price, img: p.img,
        vendor_id: p.vendor_id, type: p.type,
        selectedSize: null, selectedColor: null,
      });
    }

    const { error } = await renoncerAuComptoir(r.id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setPhase('panier');
  };

  /* ── Ce qu'il voit ──────────────────────────────────────────────────── */

  if (phase === 'panier') {
    return (
      <div className="bg-white rounded-lg p-5 text-center">
        <i className="fa-solid fa-basket-shopping text-[#007600] text-2xl" />
        <p className="text-[15px] font-bold text-[#0F1111] mt-2">Dans ton panier</p>
        <p className="text-[13px] text-[#565959] mt-1.5 leading-relaxed">
          {r.libelle} t’attend. Tu peux le commander en livraison quand tu veux —
          au prix de la boutique, sans la remise du comptoir.
        </p>
        <button onClick={() => window.dispatchEvent(new CustomEvent('ofs:openCart'))}
          className="mt-3.5 w-full bg-[#FFD814] hover:bg-[#F7CA00] rounded-full py-2.5 text-[14px] font-bold text-[#0F1111] transition">
          Voir mon panier
        </button>
      </div>
    );
  }

  if (phase === 'attente') {
    return (
      <div className="bg-white rounded-lg p-5">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#007600] animate-pulse shrink-0" />
          <p className="text-[15px] font-bold text-[#0F1111]">Compose le code sur ton téléphone</p>
        </div>
        <p className="text-[13px] text-[#565959] mt-2 leading-relaxed">
          Un message vient d’arriver sur le <b className="text-[#0F1111]">{tel}</b>.
          Valide-le avec ton code secret {OPERATEURS.find(([k]) => k === moyen)?.[1]}.
          Cet écran se met à jour tout seul.
        </p>
        <p className="text-[12px] text-[#565959] mt-3 leading-relaxed">
          Ne ferme pas la boutique : montre ton code au comptoir une fois le
          paiement passé.
        </p>
        {lien && (
          <a href={lien} target="_blank" rel="noreferrer"
            className="mt-3 block text-center text-[13px] text-[#007185] hover:text-[#C7511F] underline underline-offset-2">
            Rien reçu ? Ouvrir la page de paiement
          </a>
        )}
        <button onClick={() => { clearInterval(timer.current); setPhase('echec'); setMsg(''); }}
          className="mt-2 w-full text-[13px] text-[#565959] py-1.5">
          Ça ne marche pas
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#565959]">
        Payer {fcfa(r.prix_paye)}
      </p>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {OPERATEURS.map(([cle, nom]) => (
          <button key={cle} onClick={() => setMoyen(cle)}
            className={`rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition ${
              moyen === cle
                ? 'border-[#0F1111] bg-[#F7FAFA] text-[#0F1111] ring-1 ring-[#0F1111]'
                : 'border-[#D5D9D9] text-[#565959] hover:bg-[#F7FAFA]'}`}>
            {nom}
          </button>
        ))}
      </div>

      <input value={tel} onChange={(e) => setTel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !busy && payer()}
        inputMode="numeric" placeholder="Numéro qui paie — 6XX XX XX XX"
        className="mt-2.5 w-full bg-[#F7FAFA] border border-[#D5D9D9] rounded-lg px-4 py-3 text-[15px] outline-none focus:border-[#0F1111]" />

      <button onClick={payer} disabled={busy}
        className="mt-2.5 w-full bg-[#FFD814] hover:bg-[#F7CA00] rounded-full py-3 text-[14px] font-bold text-[#0F1111] disabled:opacity-40 transition">
        {busy ? '…' : `Payer ${fcfa(r.prix_paye)}`}
      </button>

      <p className="text-[11px] text-[#565959] mt-2 leading-relaxed">
        Tu paies maintenant, et tu retires l’article au comptoir avec ton code.
        Le commerçant n’est payé qu’une fois que tu as confirmé l’avoir en main.
      </p>

      {msg && <p className="text-[13px] text-[#B12704] mt-2.5">{msg}</p>}

      {/* La sortie de secours. Elle n'est jamais mise en avant — mais elle
          existe, et c'est elle qui évite qu'un client sans solde reparte en
          ayant tout perdu. */}
      <div className="mt-3.5 pt-3.5 border-t border-[#E7E7E7]">
        <button onClick={versLePanier} disabled={busy}
          className="w-full text-[13px] text-[#007185] hover:text-[#C7511F] py-1.5 disabled:opacity-40">
          {r.product_id
            ? 'Je ne paie pas maintenant — mets-le dans mon panier'
            : 'Je ne paie pas maintenant'}
        </button>
        {r.product_id && (
          <p className="text-[11px] text-[#565959] text-center leading-relaxed">
            Tu le retrouveras en livraison, au prix de la boutique.
          </p>
        )}
      </div>
    </div>
  );
}
