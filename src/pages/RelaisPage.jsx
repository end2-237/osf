import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { monRelais, payerRelais, confirmerRemise, annulerRelais,
         maPresence, resteAvant, etapes, fcfa } from '../lib/relais';

/* ══════════════════════════════════════════════════════════════════════════
   MON RELAIS — l'écran du client

   Il n'a pas l'application, il ne connaissait pas Buyticle il y a trois
   minutes. Un seul bouton, plein écran, et ce qu'il gagne avant de marcher.

   L'avis n'est jamais demandé ici : il arrive par notification quelques heures
   plus tard, sur une commande livrée. Écrire un avis au comptoir, sous le
   regard du commerçant, ne produit pas un avis — ça produit une politesse.
   ══════════════════════════════════════════════════════════════════════════ */

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

  if (charge) return <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">…</div>;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">Connecte-toi pour voir ton relais.</p>
        <button onClick={() => navigate('/login')}
          className="bg-gray-900 text-white rounded-xl px-6 py-3 text-sm font-semibold">
          Se connecter
        </button>
      </div>
    );
  }

  // Il a scanné un comptoir et le vendeur n'a pas encore attaché le relais.
  // C'est le seul moment où son code de présence sert, et il doit être énorme.
  if (!r && presence) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="rounded-2xl border-2 border-gray-900 p-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Montre ce code au vendeur
          </p>
          <p className="text-6xl font-black tracking-[0.2em] text-gray-900 mt-3">
            {presence.code}
          </p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            Tu es chez <b>{presence.boutique}</b>. Le vendeur le saisit, et ton
            article, ton prix et ton chemin s’afficheront ici.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          En attente du vendeur
        </div>
        <p className="text-[12px] text-gray-400 text-center mt-4">
          Ce code est valable quinze minutes. S’il expire, rescanne l’affiche
          du comptoir.
        </p>
      </div>
    );
  }

  if (!r) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900">Aucun relais en cours</p>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Quand un commerçant n’a pas ce que tu cherches, il t’envoie chez un
          voisin qui l’a — et tu obtiens une remise.
        </p>
        <div className="mt-6 rounded-2xl border border-gray-200 p-5 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Comment ça marche
          </p>
          <ol className="mt-2.5 space-y-2 text-[13px] text-gray-600">
            {['Le commerçant n’a pas ce que tu cherches et te le dit.',
              'Il te montre l’affiche Buyticle collée sur son comptoir : tu la scannes.',
              'Un code à quatre caractères apparaît ici. Tu le lui montres.',
              'Ton article, ta remise et ton chemin s’affichent. Tu y vas.'].map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-gray-900 text-white grid place-items-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
        <button onClick={() => navigate('/store')}
          className="mt-6 bg-gray-900 text-white rounded-xl px-6 py-3 text-sm font-semibold">
          Voir la boutique
        </button>
      </div>
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

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      {/* Ce qu'il gagne, avant tout le reste */}
      <div className="rounded-2xl bg-gray-900 text-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">Ton relais</p>
        <p className="text-xl font-bold mt-1.5">{r.libelle}</p>
        <div className="mt-4 space-y-1.5 text-[14px]">
          <div className="flex justify-between text-white/60">
            <span>Prix affiché</span><span className="line-through">{fcfa(r.prix_affiche)}</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span>Ta remise</span><span>− {fcfa(r.remise)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-white/10 pt-2 mt-2">
            <span>Tu paies</span><span>{fcfa(r.prix_paye)}</span>
          </div>
        </div>
        {reste && (
          <p className="text-[12px] text-white/50 mt-3">
            Valable encore {reste}, et seulement chez {r.boutique}.
          </p>
        )}
      </div>

      {/* Trois étapes. Il marche, il ne navigue pas. */}
      {r.etat === 'attribue' && (
        <div className="mt-4 rounded-2xl border border-gray-200 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">
            {r.mode === 'livre' ? 'On te l’apporte' : 'Ton chemin'}
          </p>
          {r.mode === 'livre' ? (
            <p className="text-sm text-gray-700 leading-relaxed">
              {r.boutique} te livre sur place. Tu ne paies qu’à la remise, et si
              l’article ne te convient pas tu n’es pas débité.
            </p>
          ) : (
            <ol className="space-y-3">
              {etapes(r).map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-900 text-white grid place-items-center text-[11px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{e.t}</p>
                    {e.s && <p className="text-[12px] text-gray-500">{e.s}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {r.lat != null && r.mode !== 'livre' && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
               target="_blank" rel="noreferrer"
               className="mt-4 block text-center border border-gray-200 rounded-xl py-2.5 text-[13px] font-semibold text-gray-700">
              Ouvrir le plan
            </a>
          )}
        </div>
      )}

      {/* Le code, en très grand : il se lit à voix haute dans une allée bruyante */}
      <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-300 p-5 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
          {r.mode === 'livre' ? 'Montre ce code à celui qui apporte' : 'Montre ce code au comptoir'}
        </p>
        <p className="text-4xl font-black tracking-[0.25em] text-gray-900 mt-2">{r.code}</p>
        <p className="text-[12px] text-gray-500 mt-2">
          {r.mode === 'livre'
            ? `Seul ${r.boutique} peut l’honorer. Ne paie qu’une fois l’article devant toi.`
            : `Il ne marche que chez ${r.boutique}. Personne d’autre ne peut l’honorer.`}
        </p>
      </div>

      {r.etat === 'arrive' && (
        <button onClick={payer}
          className="mt-4 w-full bg-gray-900 text-white rounded-xl py-4 text-sm font-bold">
          Payer {fcfa(r.prix_paye)}
        </button>
      )}

      {r.etat === 'paye' && (
        <>
          <button onClick={confirmer}
            className="mt-4 w-full bg-emerald-600 text-white rounded-xl py-4 text-sm font-bold">
            J’ai mon article
          </button>
          <p className="text-[12px] text-gray-500 text-center mt-2">
            {r.mode === 'livre'
              ? 'La boutique peut aussi confirmer de son côté. Ne le fais qu’avec l’article en main.'
              : 'Ne confirme qu’une fois l’article en main.'}
          </p>
        </>
      )}

      {r.etat === 'attribue' && (
        <button onClick={() => annulerRelais(r.id).then(recharger)}
          className="mt-3 w-full text-[13px] text-gray-400 py-2">
          {r.mode === 'livre' ? 'Finalement, je n’en veux pas' : 'Finalement, je n’y vais pas'}
        </button>
      )}

      {msg && <p className="text-[13px] text-gray-600 text-center mt-3">{msg}</p>}
    </div>
  );
}
