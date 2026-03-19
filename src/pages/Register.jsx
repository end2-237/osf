import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ofsLogo from '../assets/ofs.png';

// ─── PLANS ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 0, period: 'Gratuit', badge: null, color: 'zinc',
    features: [
      { text: '5 produits max', ok: true },
      { text: 'Boutique personnalisée', ok: true },
      { text: 'Commandes & notifications', ok: true },
      { text: 'Analytics basiques', ok: true },
      { text: 'Remise membre −20%', ok: false },
      { text: 'Flash Drops', ok: false },
      { text: 'Badge ✓ Vérifié', ok: false },
      { text: 'Support prioritaire', ok: false },
    ],
  },
  {
    id: 'pro', name: 'Pro', price: 5000, period: '/ mois', badge: 'Populaire', color: 'primary',
    features: [
      { text: '30 produits', ok: true },
      { text: 'Boutique personnalisée', ok: true },
      { text: 'Commandes & notifications', ok: true },
      { text: 'Analytics avancés', ok: true },
      { text: 'Remise membre −20%', ok: true },
      { text: 'Flash Drops', ok: false },
      { text: 'Badge ✓ Vérifié', ok: true },
      { text: 'Support prioritaire', ok: false },
    ],
  },
  {
    id: 'elite', name: 'Elite', price: 15000, period: '/ mois', badge: 'Max', color: 'yellow',
    features: [
      { text: 'Produits illimités', ok: true },
      { text: 'Boutique personnalisée', ok: true },
      { text: 'Commandes & notifications', ok: true },
      { text: 'Analytics avancés + exports', ok: true },
      { text: 'Remise membre −20%', ok: true },
      { text: 'Flash Drops exclusifs', ok: true },
      { text: 'Badge ✓ Elite Vérifié', ok: true },
      { text: 'Account manager dédié', ok: true },
    ],
  },
];

const ID_TYPES = [
  { value: 'cni',      label: "Carte Nationale d'Identité", short: 'CNI'      },
  { value: 'passport', label: 'Passeport',                  short: 'Passport' },
  { value: 'permis',   label: 'Permis de conduire',         short: 'Permis'   },
];

const VENDOR_STEPS = [
  { key: 'account',  label: 'Compte',     icon: 'fa-user'        },
  { key: 'info',     label: 'Boutique',   icon: 'fa-store'       },
  { key: 'plan',     label: 'Abonnement', icon: 'fa-crown'       },
  { key: 'identity', label: 'Identité',   icon: 'fa-id-card'     },
  { key: 'liveness', label: 'Selfie',     icon: 'fa-face-smile'  },
  { key: 'review',   label: 'Soumission', icon: 'fa-paper-plane' },
];

const LIVENESS_STEPS = [
  { id: 'center',  icon: 'fa-crosshairs', label: 'Centrez votre visage',        color: 'text-blue-400'   },
  { id: 'blink',   icon: 'fa-eye-slash',  label: 'Clignez des yeux 2x',         color: 'text-yellow-400' },
  { id: 'smile',   icon: 'fa-face-smile', label: 'Souriez',                     color: 'text-green-400'  },
  { id: 'left',    icon: 'fa-arrow-left', label: 'Tournez legerement a gauche', color: 'text-purple-400' },
  { id: 'capture', icon: 'fa-camera',     label: 'Maintenez la position...',    color: 'text-primary'    },
];

const SHOP_CATEGORIES = [
  'Audio Lab', 'Mode Femme', 'Sneakers', 'Streetwear',
  'Tech Lab', 'Parfums', 'Accessories', 'Divers',
];

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Ico = {
  User:     () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  Business: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745V20a2 2 0 002 2h14a2 2 0 002-2v-6.745zM16 8V5a2 2 0 00-2-2H10a2 2 0 00-2 2v3H4a2 2 0 00-2 2v3a2 2 0 002 2h16a2 2 0 002-2v-3a2 2 0 00-2-2h-4zM10 8h4V5h-4v3z"/></svg>,
  Check:    () => <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>,
  Gift:     () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>,
  X:        () => <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>,
  Star:     () => <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
};

// ─── REFERRAL HELPERS ────────────────────────────────────────────────────────
function detectReferralCode(searchParams, location) {
  const fromRef      = searchParams.get('ref');       if (fromRef)                          return fromRef.toUpperCase();
  const fromReferral = searchParams.get('referral');  if (fromReferral)                     return fromReferral.toUpperCase();
  const fromCode     = searchParams.get('code');      if (fromCode?.startsWith('OFS-'))     return fromCode.toUpperCase();
  const pathMatch    = location.pathname.match(/OFS-[A-Z0-9]{6}/i); if (pathMatch)         return pathMatch[0].toUpperCase();
  const stored       = localStorage.getItem('ofs_referral_code');   if (stored)            return stored.toUpperCase();
  return null;
}

async function validateReferralCode(code) {
  if (!code) return null;
  const { data, error } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('referral_code', code).single();
  if (error || !data) return null;
  return data;
}

async function processReferral(referrerId, newUserId) {
  try {
    await supabase.from('referrals').insert({ referrer_id: referrerId, referred_id: newUserId, created_at: new Date().toISOString() });
    const { data: profile } = await supabase.from('profiles').select('loyalty_points').eq('id', referrerId).single();
    const currentPts = profile?.loyalty_points ?? 0;
    await supabase.from('loyalty_transactions').insert({ user_id: referrerId, type: 'referral_bonus', points: 200, reference_id: newUserId, description: 'Bonus parrainage - nouvel inscrit', created_at: new Date().toISOString() });
    await supabase.from('profiles').update({ loyalty_points: currentPts + 200 }).eq('id', referrerId);
    await supabase.from('loyalty_transactions').insert({ user_id: newUserId, type: 'welcome_bonus', points: 50, reference_id: referrerId, description: 'Bonus bienvenue - parraine par un membre', created_at: new Date().toISOString() });
    await supabase.from('profiles').update({ loyalty_points: 50 }).eq('id', newUserId);
  } catch (err) { console.warn('[processReferral]', err.message); }
}

// ─── UPLOAD ZONE ─────────────────────────────────────────────────────────────
const UploadZone = ({ label, sub, onChange, preview }) => {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const handleDrop = (e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onChange(f); };
  return (
    <div
      className={`relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${drag ? 'border-primary bg-primary/5' : preview ? 'border-primary/40' : 'border-white/10 hover:border-primary/30'}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files[0] && onChange(e.target.files[0])} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="" className="w-full h-28 object-cover rounded-xl" />
          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-[8px] font-black uppercase text-white bg-black/60 px-2 py-1 rounded-full">Changer</span>
          </div>
          <div className="absolute top-1.5 right-1.5 bg-primary text-black text-[7px] font-black px-1.5 py-0.5 rounded-full">OK</div>
        </div>
      ) : (
        <div className="py-5 text-center px-3">
          <i className="fa-solid fa-cloud-arrow-up text-zinc-600 text-xl mb-2 block"></i>
          <p className="font-black text-[10px] text-white uppercase">{label}</p>
          <p className="text-[8px] text-zinc-600 font-bold mt-0.5">{sub}</p>
          <p className="text-[7px] text-zinc-700 mt-0.5">JPG / PNG / PDF - Max 5MB</p>
        </div>
      )}
    </div>
  );
};

// ─── STEPPER ─────────────────────────────────────────────────────────────────
const VendorStepper = ({ steps, currentIndex }) => (
  <div className="relative mb-8">
    <div className="absolute top-4 left-0 right-0 h-px bg-white/5" />
    <div className="flex items-start justify-between relative">
      {steps.map((s, i) => {
        const done = i < currentIndex, active = i === currentIndex;
        return (
          <div key={s.key} className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${done ? 'bg-primary border-primary' : active ? 'bg-primary/15 border-primary shadow-[0_0_14px_rgba(0,255,136,0.25)]' : 'bg-zinc-950 border-white/10'}`}>
              {done ? <i className="fa-solid fa-check text-black text-[9px]"></i> : <i className={`fa-solid ${s.icon} text-[9px] ${active ? 'text-primary' : 'text-zinc-600'}`}></i>}
            </div>
            <span className={`text-[6px] font-black uppercase tracking-widest whitespace-nowrap hidden sm:block ${active ? 'text-primary' : done ? 'text-zinc-400' : 'text-zinc-700'}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── NAV BUTTONS ─────────────────────────────────────────────────────────────
const NavBtns = ({ onBack, onNext, nextLabel = 'Continuer', nextDisabled = false, loading = false }) => (
  <div className="flex justify-between pt-3">
    {onBack
      ? <button type="button" onClick={onBack} className="flex items-center gap-2 border border-white/10 text-zinc-400 px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-white/20 transition">
          <i className="fa-solid fa-arrow-left text-[9px]"></i> Retour
        </button>
      : <div />}
    <button type="button" onClick={onNext} disabled={nextDisabled || loading}
      className="flex items-center gap-2 bg-primary text-black px-7 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105">
      {loading ? <><i className="fa-solid fa-spinner fa-spin text-[9px]"></i> Traitement...</> : <>{nextLabel} <i className="fa-solid fa-arrow-right text-[9px]"></i></>}
    </button>
  </div>
);

// ─── REFERRAL INPUT ───────────────────────────────────────────────────────────
const ReferralInput = ({ refInput, setRefInput, refStatus, refOwner, clearRef, dark = false }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
        <Ico.Gift /> Code Parrainage <span className="text-zinc-700 normal-case font-bold">(optionnel)</span>
      </label>
      {refStatus === 'valid' && <span className={`text-[7px] font-black uppercase ${dark ? 'text-primary' : 'text-emerald-600'}`}>+50 pts offerts</span>}
    </div>
    <div className="relative">
      <input
        type="text" value={refInput} onChange={e => setRefInput(e.target.value)}
        className={`w-full border rounded-lg p-2.5 pr-9 text-xs font-bold outline-none transition-all uppercase tracking-wider placeholder:normal-case
          ${dark
            ? `bg-zinc-900 ${refStatus === 'valid' ? 'border-primary/50 text-primary' : refStatus === 'invalid' ? 'border-red-500/40 text-red-400' : 'border-white/8 text-white focus:border-primary/30'}`
            : `bg-zinc-50/50 placeholder:text-zinc-300 ${refStatus === 'valid' ? 'border-emerald-300 bg-emerald-50/30 text-emerald-700' : refStatus === 'invalid' ? 'border-red-200 bg-red-50/30 text-red-600' : 'border-zinc-100 focus:border-zinc-900'}`
          }`}
        placeholder="OFS-XXXXXX" maxLength={12}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {refStatus === 'checking' && <div className={`w-3 h-3 border-2 rounded-full animate-spin ${dark ? 'border-zinc-600 border-t-primary' : 'border-zinc-300 border-t-zinc-700'}`} />}
        {refStatus === 'valid'    && <div className={`w-4 h-4 rounded-full flex items-center justify-center ${dark ? 'bg-primary' : 'bg-emerald-500'}`}><svg className={`w-2.5 h-2.5 ${dark ? 'text-black' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg></div>}
        {refStatus === 'invalid'  && <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center cursor-pointer" onClick={clearRef}><Ico.X /></div>}
      </div>
    </div>
    {refStatus === 'valid' && refOwner && (
      <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border ${dark ? 'bg-primary/8 border-primary/20' : 'bg-emerald-50 border-emerald-100'}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center flex-shrink-0"><Ico.Star /></div>
          <span className={`text-[8px] font-black uppercase tracking-wider ${dark ? 'text-primary' : 'text-emerald-800'}`}>Parraine par <span className={dark ? 'text-white' : 'text-primary'}>{refOwner.full_name}</span></span>
        </div>
        <button type="button" onClick={clearRef} className="text-zinc-400 hover:text-zinc-600 transition"><Ico.X /></button>
      </div>
    )}
    {refStatus === 'invalid' && refInput.length > 0 && <p className={`text-[8px] font-bold ml-1 ${dark ? 'text-red-400' : 'text-red-500'}`}>Code introuvable. Verifiez et reessayez.</p>}
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Register() {
  const { signUpMember, signUpVendor } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [flow,      setFlow]      = useState('member');
  const [vStep,     setVStep]     = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Member form
  const [mForm, setMForm] = useState({ email: '', password: '', confirm: '', displayName: '' });

  // Vendor form
  const [vForm, setVForm] = useState({
    email: '', password: '', confirm: '',
    full_name: '', shop_name: '', phone: '', city: 'Douala',
    category: '', description: '', plan: 'starter',
    id_type: '', id_front: null, id_back: null,
  });
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview,  setBackPreview]  = useState(null);

  // Liveness
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [livenessPhase, setLivenessPhase] = useState('intro');
  const [livenessIdx,   setLivenessIdx]   = useState(0);
  const [countdown,     setCountdown]     = useState(null);
  const [selfieUrl,     setSelfieUrl]     = useState(null);
  const [selfieBlob,    setSelfieBlob]    = useState(null);
  const [camError,      setCamError]      = useState('');

  // Referral
  const [refInput,  setRefInput]  = useState('');
  const [refCode,   setRefCode]   = useState('');
  const [refOwner,  setRefOwner]  = useState(null);
  const [refStatus, setRefStatus] = useState('idle');
  const [rgpdOk,    setRgpdOk]    = useState(false);

  // Auto-detect referral on mount
  useEffect(() => {
    const detected = detectReferralCode(searchParams, location);
    if (detected) {
      setRefInput(detected); setRefCode(detected);
      localStorage.setItem('ofs_referral_code', detected);
      validateReferralCode(detected).then(owner => {
        if (owner) { setRefOwner(owner); setRefStatus('valid'); }
        else        { setRefStatus('invalid'); }
      });
    }
  }, []);

  // Debounced referral validation
  useEffect(() => {
    if (!refInput || refInput === refCode) return;
    const fmt = refInput.toUpperCase().trim();
    if (!fmt.startsWith('OFS-') || fmt.length < 10) { setRefStatus('idle'); setRefOwner(null); return; }
    setRefStatus('checking');
    const t = setTimeout(() => {
      validateReferralCode(fmt).then(owner => {
        if (owner) { setRefCode(fmt); setRefOwner(owner); setRefStatus('valid'); localStorage.setItem('ofs_referral_code', fmt); }
        else        { setRefOwner(null); setRefStatus('invalid'); }
      });
    }, 600);
    return () => clearTimeout(t);
  }, [refInput]);

  const clearRef = () => { setRefInput(''); setRefCode(''); setRefOwner(null); setRefStatus('idle'); localStorage.removeItem('ofs_referral_code'); };
  const setVF = (k, v) => setVForm(p => ({ ...p, [k]: v }));

  const handleDocFile = (side, file) => {
    if (file.size > 5 * 1024 * 1024) return;
    const url = URL.createObjectURL(file);
    if (side === 'front') { setFrontPreview(url); setVF('id_front', file); }
    else                  { setBackPreview(url);  setVF('id_back',  file); }
  };

  // Camera
  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  useEffect(() => () => stopCamera(), []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setLivenessPhase('stream'); setLivenessIdx(0);
      let idx = 0;
      const iv = setInterval(() => {
        setLivenessIdx(prev => {
          idx = prev + 1;
          if (idx >= LIVENESS_STEPS.length) {
            clearInterval(iv);
            let c = 3; setCountdown(c);
            const ci = setInterval(() => { c--; if (c <= 0) { clearInterval(ci); setCountdown(null); captureFrame(); } else setCountdown(c); }, 1000);
          }
          return idx;
        });
      }, 1800);
    } catch (e) { setCamError("Acces a la camera refuse. Autorisez l'acces dans les parametres du navigateur."); setLivenessPhase('error'); }
  }, []);

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width  = videoRef.current.videoWidth  || 640;
    canvasRef.current.height = videoRef.current.videoHeight || 480;
    ctx.drawImage(videoRef.current, 0, 0);
    const url = canvasRef.current.toDataURL('image/jpeg', 0.85);
    setSelfieUrl(url); stopCamera(); setLivenessPhase('done');
    canvasRef.current.toBlob(blob => setSelfieBlob(blob), 'image/jpeg', 0.85);
  };

  const retryLiveness = () => { setSelfieUrl(null); setSelfieBlob(null); setLivenessPhase('intro'); setLivenessIdx(0); setCountdown(null); };

  // Step validations
  const vValid = [
    !!(vForm.email && vForm.password && vForm.confirm && vForm.password === vForm.confirm),
    !!(vForm.shop_name && vForm.full_name && vForm.phone && vForm.category),
    !!vForm.plan,
    !!(vForm.id_type && vForm.id_front && vForm.id_back),
    !!selfieUrl,
    rgpdOk,
  ];

  // Member submit
  async function handleMemberSubmit(e) {
    e.preventDefault(); setError('');
    if (mForm.password !== mForm.confirm) return setError('Mots de passe non identiques.');
    setLoading(true);
    try {
      const result = await signUpMember(mForm.email, mForm.password, mForm.displayName);
      const uid = result?.user?.id ?? result?.id ?? null;
      if (uid && refStatus === 'valid' && refOwner) { await processReferral(refOwner.id, uid); localStorage.removeItem('ofs_referral_code'); }
      setSuccess('Profil cree ! Verifiez votre boite mail.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // Vendor submit
  async function handleVendorSubmit() {
    setLoading(true); setError('');
    try {
      const result = await signUpVendor(vForm.email, vForm.password, { full_name: vForm.full_name, shop_name: vForm.shop_name, phone: vForm.phone });
      const uid = result?.user?.id ?? result?.id ?? null;
      const ts = Date.now(); const base = `vendor-kyc/${uid}/${ts}`;
      let idFrontUrl = null, idBackUrl = null, selfieStorageUrl = null;
      if (vForm.id_front) {
        const ext = vForm.id_front.name.split('.').pop();
        await supabase.storage.from('kyc-documents').upload(`${base}/id-front.${ext}`, vForm.id_front, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(`${base}/id-front.${ext}`);
        idFrontUrl = publicUrl;
      }
      if (vForm.id_back) {
        const ext = vForm.id_back.name.split('.').pop();
        await supabase.storage.from('kyc-documents').upload(`${base}/id-back.${ext}`, vForm.id_back, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(`${base}/id-back.${ext}`);
        idBackUrl = publicUrl;
      }
      if (selfieBlob) {
        await supabase.storage.from('kyc-documents').upload(`${base}/selfie.jpg`, selfieBlob, { contentType: 'image/jpeg', upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(`${base}/selfie.jpg`);
        selfieStorageUrl = publicUrl;
      }
      await supabase.from('vendor_applications').insert({
        user_id: uid, shop_name: vForm.shop_name, full_name: vForm.full_name,
        phone: vForm.phone, city: vForm.city, category: vForm.category,
        description: vForm.description, plan: vForm.plan, id_type: vForm.id_type,
        id_front_url: idFrontUrl, id_back_url: idBackUrl, selfie_url: selfieStorageUrl,
        status: 'pending', submitted_at: new Date().toISOString(),
      });
      if (uid && refStatus === 'valid' && refOwner) { await processReferral(refOwner.id, uid); localStorage.removeItem('ofs_referral_code'); }
      setSubmitted(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const currentLivenessStep = LIVENESS_STEPS[Math.min(livenessIdx, LIVENESS_STEPS.length - 1)];

  // ─── VENDOR SUBMITTED ────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-primary/15 border-2 border-primary/40 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse">
            <i className="fa-solid fa-paper-plane text-primary text-3xl"></i>
          </div>
          <h2 className="font-black text-2xl italic uppercase tracking-tighter text-white mb-2">Demande soumise !</h2>
          <p className="text-zinc-500 font-bold text-sm mb-1 leading-relaxed">
            Votre dossier est en cours d'examen. Reponse par email dans <strong className="text-white">24 a 48h</strong>.
          </p>
          <p className="text-zinc-700 text-[9px] font-bold mb-6">Plan choisi : <span className="text-primary uppercase">{vForm.plan}</span></p>
          <div className="flex flex-col gap-2">
            <Link to="/" className="flex items-center justify-center gap-2 bg-primary text-black px-8 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition">
              <i className="fa-solid fa-house text-xs"></i> Retour a l'accueil
            </Link>
            <Link to="/login" className="flex items-center justify-center gap-2 border border-white/10 text-zinc-400 px-8 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-white/20 transition">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── VENDOR FLOW (dark full-page) ────────────────────────────────
  if (flow === 'vendor') {
    return (
      <div className="min-h-screen bg-black text-white font-sans select-none overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-4 py-10">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <img src={ofsLogo} alt="Logo" className="w-5 h-5 object-contain invert" />
              <span className="text-white text-[10px] font-black tracking-[0.3em] uppercase italic">OFS Elite</span>
            </div>
            <button onClick={() => { setFlow('member'); setVStep(0); setError(''); }}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-[8px] font-black uppercase tracking-widest transition">
              <Ico.X /> Annuler
            </button>
          </div>

          {/* Title */}
          <div className="mb-6 flex items-center gap-4">
            <div className="w-11 h-11 bg-primary/15 border border-primary/30 rounded-2xl flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-store-check text-primary text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">Ouvrir une Boutique Elite</h1>
              <p className="text-zinc-500 text-[9px] font-bold mt-0.5">KYC requis - Donnees chiffrees AES-256</p>
            </div>
          </div>

          {/* Stepper */}
          <VendorStepper steps={VENDOR_STEPS} currentIndex={vStep} />

          {/* Step content */}
          <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6">

            {/* STEP 0 - COMPTE */}
            {vStep === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">Creez votre acces</h2>
                  <p className="text-zinc-500 text-[11px] font-bold">Email et mot de passe pour vous connecter a votre boutique.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Email professionnel</label>
                    <input type="email" value={vForm.email} onChange={e => setVF('email', e.target.value)}
                      className="w-full bg-zinc-900 border border-white/8 focus:border-primary/40 rounded-xl px-4 py-3 text-xs text-white font-bold placeholder-zinc-700 outline-none transition"
                      placeholder="pro@boutique.cm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Mot de passe</label>
                      <input type="password" value={vForm.password} onChange={e => setVF('password', e.target.value)}
                        className="w-full bg-zinc-900 border border-white/8 focus:border-primary/40 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none transition"
                        placeholder="••••••••" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Confirmer</label>
                      <input type="password" value={vForm.confirm} onChange={e => setVF('confirm', e.target.value)}
                        className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-xs text-white font-bold outline-none transition ${vForm.confirm && vForm.confirm !== vForm.password ? 'border-red-500/50' : 'border-white/8 focus:border-primary/40'}`}
                        placeholder="••••••••" />
                    </div>
                  </div>
                  {vForm.confirm && vForm.confirm !== vForm.password && <p className="text-[8px] font-bold text-red-400">Mots de passe non identiques.</p>}
                  <ReferralInput refInput={refInput} setRefInput={setRefInput} refStatus={refStatus} refOwner={refOwner} clearRef={clearRef} dark={true} />
                </div>
                {error && <p className="text-[8px] font-bold text-red-400 bg-red-500/8 border border-red-500/20 p-2 rounded-lg text-center uppercase">{error}</p>}
                <NavBtns onNext={() => { setError(''); setVStep(1); }} nextDisabled={!vValid[0]} />
              </div>
            )}

            {/* STEP 1 - BOUTIQUE */}
            {vStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">Infos de la boutique</h2>
                  <p className="text-zinc-500 text-[11px] font-bold">Ces informations seront visibles par vos clients.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { k: 'shop_name', label: 'Nom boutique *', ph: 'Ex: SoundElite',   icon: 'fa-store'        },
                    { k: 'full_name', label: 'Nom du gerant *',ph: 'Nom et prenom',    icon: 'fa-user'         },
                    { k: 'phone',     label: 'Telephone *',    ph: '+237 6XX XXX XXX', icon: 'fa-phone'        },
                    { k: 'city',      label: 'Ville',          ph: 'Douala',            icon: 'fa-location-dot' },
                  ].map(f => (
                    <div key={f.k}>
                      <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                      <div className="relative">
                        <i className={`fa-solid ${f.icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 text-xs`}></i>
                        <input value={vForm[f.k] || ''} onChange={e => setVF(f.k, e.target.value)} placeholder={f.ph}
                          className="w-full bg-zinc-900 border border-white/8 focus:border-primary/40 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white font-bold placeholder-zinc-700 outline-none transition" />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">Categorie *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SHOP_CATEGORIES.map(cat => (
                      <button key={cat} type="button" onClick={() => setVF('category', cat)}
                        className={`py-2 px-2 rounded-xl text-[8px] font-black uppercase border-2 transition-all ${vForm.category === cat ? 'border-primary bg-primary/15 text-primary' : 'border-white/8 text-zinc-500 hover:border-white/20 hover:text-white'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Description</label>
                  <textarea value={vForm.description || ''} onChange={e => setVF('description', e.target.value)} rows={3} placeholder="Decrivez votre boutique, vos produits..."
                    className="w-full bg-zinc-900 border border-white/8 focus:border-primary/40 rounded-xl px-4 py-3 text-xs text-white font-bold placeholder-zinc-700 outline-none transition resize-none" />
                </div>
                <NavBtns onBack={() => setVStep(0)} onNext={() => setVStep(2)} nextDisabled={!vValid[1]} />
              </div>
            )}

            {/* STEP 2 - PLAN */}
            {vStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">Choisissez votre plan</h2>
                  <p className="text-zinc-500 text-[11px] font-bold">Modifiable a tout moment depuis votre dashboard.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLANS.map(plan => {
                    const sel = vForm.plan === plan.id;
                    const border = { zinc: sel ? 'border-zinc-400' : 'border-white/8', primary: sel ? 'border-primary' : 'border-white/8', yellow: sel ? 'border-yellow-400' : 'border-white/8' }[plan.color];
                    const glow   = { zinc: '', primary: sel ? 'shadow-[0_0_20px_rgba(0,255,136,0.12)]' : '', yellow: sel ? 'shadow-[0_0_20px_rgba(250,204,21,0.12)]' : '' }[plan.color];
                    const bStyle = { zinc: 'bg-zinc-800 text-zinc-300', primary: 'bg-primary/15 text-primary', yellow: 'bg-yellow-400/15 text-yellow-300' }[plan.color];
                    return (
                      <button key={plan.id} type="button" onClick={() => setVF('plan', plan.id)}
                        className={`relative text-left rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all bg-zinc-900 hover:border-white/20 ${border} ${glow}`}>
                        {plan.badge && <span className={`absolute -top-2.5 left-4 text-[7px] font-black uppercase px-2 py-0.5 rounded-full border ${bStyle} border-current`}>{plan.badge}</span>}
                        {sel && <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center"><i className="fa-solid fa-check text-black text-[8px]"></i></div>}
                        <div>
                          <p className="text-[7px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">{plan.name}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black italic text-white">{plan.price === 0 ? '0' : plan.price.toLocaleString()}</span>
                            <span className="text-[10px] text-zinc-500 font-bold">FCFA {plan.period}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {plan.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <i className={`fa-solid ${f.ok ? 'fa-check text-primary' : 'fa-xmark text-zinc-700'} text-[9px] flex-shrink-0`}></i>
                              <span className={`text-[9px] font-bold ${f.ok ? 'text-zinc-300' : 'text-zinc-600'}`}>{f.text}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-3 flex items-start gap-2">
                  <i className="fa-solid fa-circle-info text-blue-400 text-xs flex-shrink-0 mt-0.5"></i>
                  <p className="text-[9px] font-bold text-zinc-500">Le paiement se fait apres validation de votre identite. Vous pouvez commencer avec le plan Gratuit et upgrader a tout moment.</p>
                </div>
                <NavBtns onBack={() => setVStep(1)} onNext={() => setVStep(3)} nextDisabled={!vValid[2]} />
              </div>
            )}

            {/* STEP 3 - IDENTITE */}
            {vStep === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">Verification d'identite</h2>
                  <p className="text-zinc-500 text-[11px] font-bold">Documents chiffres - supprimes apres validation.</p>
                </div>
                <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                  <i className="fa-solid fa-shield-halved text-blue-400 text-sm flex-shrink-0 mt-0.5"></i>
                  <p className="text-[9px] font-bold text-zinc-500 leading-relaxed">Vos documents sont stockes sur un serveur chiffre AES-256, accessibles uniquement par notre equipe. Conforme a la loi camerounaise N°2010/012.</p>
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">Type de document *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ID_TYPES.map(t => (
                      <button key={t.value} type="button" onClick={() => setVF('id_type', t.value)}
                        className={`py-3 px-3 rounded-xl border-2 text-[9px] font-black uppercase text-center transition-all ${vForm.id_type === t.value ? 'border-primary bg-primary/15 text-primary' : 'border-white/8 text-zinc-500 hover:border-white/20'}`}>
                        {t.short}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block"><span className="text-primary">+</span> Recto *</label>
                    <UploadZone label="Face avant" sub="Avec votre photo" onChange={f => handleDocFile('front', f)} preview={frontPreview} />
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block"><span className="text-primary">+</span> Verso *</label>
                    <UploadZone label="Face arriere" sub="Dos du document" onChange={f => handleDocFile('back', f)} preview={backPreview} />
                  </div>
                </div>
                <div className="bg-zinc-900 border border-white/5 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[['fa-sun','Bonne lumiere'],['fa-eye','Texte lisible'],['fa-crop','Doc entier'],['fa-hand','Pas de reflet']].map(([icon, label]) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className={`fa-solid ${icon} text-primary text-[9px]`}></i>
                      </div>
                      <span className="text-[8px] font-bold text-zinc-500">{label}</span>
                    </div>
                  ))}
                </div>
                <NavBtns onBack={() => setVStep(2)} onNext={() => setVStep(4)} nextDisabled={!vValid[3]} />
              </div>
            )}

            {/* STEP 4 - LIVENESS */}
            {vStep === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">Verification faciale en direct</h2>
                  <p className="text-zinc-500 text-[11px] font-bold">Un selfie guide pour confirmer que vous etes le detenteur du document.</p>
                </div>

                {livenessPhase === 'intro' && !selfieUrl && (
                  <div className="space-y-4">
                    <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-white/5 space-y-2.5">
                        {LIVENESS_STEPS.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                              <i className={`fa-solid ${s.icon} ${s.color} text-xs`}></i>
                            </div>
                            <p className="text-[10px] font-bold text-zinc-400">{i + 1}. {s.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 grid grid-cols-3 gap-3">
                        {[['fa-lightbulb','Bonne lumiere','Face a une fenetre'],['fa-glasses','Lunettes OK','Pas de masque'],['fa-wifi','Connexion stable','WiFi recommande']].map(([icon, label, sub]) => (
                          <div key={label} className="text-center">
                            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-1.5">
                              <i className={`fa-solid ${icon} text-primary text-sm`}></i>
                            </div>
                            <p className="text-[8px] font-black text-white uppercase">{label}</p>
                            <p className="text-[7px] text-zinc-600 font-bold">{sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={startCamera}
                      className="w-full flex items-center justify-center gap-3 bg-primary text-black py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition">
                      <i className="fa-solid fa-camera text-sm"></i> Demarrer la verification
                    </button>
                  </div>
                )}

                {livenessPhase === 'stream' && (
                  <div className="space-y-3">
                    <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
                      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-52 border-4 border-primary/70 rounded-full opacity-70" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
                      </div>
                      <div className="absolute top-3 left-0 right-0 flex justify-center">
                        <div className={`flex items-center gap-2 bg-black/70 border border-white/10 px-3 py-2 rounded-full ${currentLivenessStep.color}`}>
                          <i className={`fa-solid ${currentLivenessStep.icon} text-sm`}></i>
                          <span className="text-[10px] font-black uppercase">{currentLivenessStep.label}</span>
                        </div>
                      </div>
                      {countdown !== null && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                          <div className="text-7xl font-black text-primary animate-pulse">{countdown}</div>
                        </div>
                      )}
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                        {LIVENESS_STEPS.map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i <= livenessIdx ? 'bg-primary scale-125' : 'bg-white/30'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[8px] font-bold text-zinc-600 text-center">Suivez les instructions - Capture automatique</p>
                  </div>
                )}

                {(livenessPhase === 'done' || selfieUrl) && selfieUrl && (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden">
                      <img src={selfieUrl} alt="Selfie" className="w-full max-h-64 object-cover scale-x-[-1]" />
                      <div className="absolute top-2.5 right-2.5 bg-primary text-black text-[7px] font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
                        <i className="fa-solid fa-check text-[8px]"></i> Selfie capture
                      </div>
                    </div>
                    <button onClick={retryLiveness}
                      className="w-full flex items-center justify-center gap-2 border border-white/10 text-zinc-400 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-primary/30 hover:text-primary transition">
                      <i className="fa-solid fa-rotate-left text-xs"></i> Reprendre le selfie
                    </button>
                  </div>
                )}

                {livenessPhase === 'error' && (
                  <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-5 text-center">
                    <i className="fa-solid fa-camera-slash text-red-400 text-2xl mb-2 block"></i>
                    <p className="font-black text-red-300 text-sm mb-1">Acces camera requis</p>
                    <p className="text-[9px] text-zinc-500 font-bold mb-4">{camError}</p>
                    <button onClick={startCamera} className="bg-primary text-black px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white transition">Reessayer</button>
                  </div>
                )}

                {livenessPhase !== 'stream' && <canvas ref={canvasRef} className="hidden" />}
                <NavBtns onBack={() => setVStep(3)} onNext={() => setVStep(5)} nextDisabled={!vValid[4]} />
              </div>
            )}

            {/* STEP 5 - REVIEW */}
            {vStep === 5 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">Recapitulatif</h2>
                  <p className="text-zinc-500 text-[11px] font-bold">Verifiez vos informations avant de soumettre.</p>
                </div>
                <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                  <div className="p-4">
                    <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-2">Boutique</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[['Nom', vForm.shop_name],['Gerant', vForm.full_name],['Telephone', vForm.phone],['Ville', vForm.city],['Categorie', vForm.category],['Plan', vForm.plan.toUpperCase()]].map(([k, v]) => (
                        <div key={k}><p className="text-[7px] text-zinc-600 font-bold uppercase">{k}</p><p className="text-[10px] font-black text-white mt-0.5">{v || 'N/A'}</p></div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div><p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Plan choisi</p><p className="font-black text-primary text-base uppercase italic">{PLANS.find(p => p.id === vForm.plan)?.name}</p></div>
                    <p className="font-black text-white text-lg italic">{vForm.plan === 'starter' ? 'Gratuit' : `${PLANS.find(p=>p.id===vForm.plan)?.price?.toLocaleString()} FCFA/mois`}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-3">Documents soumis</p>
                    <div className="flex gap-4">
                      {[['fa-id-card','Recto'],['fa-id-card','Verso'],['fa-face-smile','Selfie']].map(([icon, label], i) => (
                        <div key={label} className="text-center">
                          {i === 2 && selfieUrl
                            ? <img src={selfieUrl} alt="" className="w-10 h-10 object-cover rounded-xl mx-auto mb-1 scale-x-[-1]" />
                            : <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mx-auto mb-1"><i className={`fa-solid ${icon} text-primary text-sm`}></i></div>}
                          <p className="text-[7px] font-black text-primary uppercase">{label} v</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-3">Prochaines etapes</p>
                    <div className="space-y-2.5">
                      {[['fa-paper-plane','Soumission','Maintenant','text-primary'],['fa-eye','Verification identite','24-48h','text-blue-400'],['fa-store','Activation boutique','Apres validation','text-yellow-400'],['fa-credit-card','Paiement plan','Si Pro / Elite','text-purple-400']].map(([icon,label,time,color]) => (
                        <div key={label} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className={`fa-solid ${icon} ${color} text-[9px]`}></i>
                          </div>
                          <div><p className="text-[9px] font-black text-white uppercase">{label}</p><p className="text-[7px] text-zinc-600 font-bold">{time}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer p-3 bg-zinc-900 border border-white/5 rounded-xl hover:border-primary/20 transition">
                  <input type="checkbox" checked={rgpdOk} onChange={e => setRgpdOk(e.target.checked)} className="accent-primary w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-[9px] font-bold text-zinc-400 leading-relaxed">
                    J'atteste que les informations sont exactes et que les documents m'appartiennent. J'accepte les{' '}
                    <span className="text-primary underline cursor-pointer">conditions d'utilisation</span> et la{' '}
                    <span className="text-primary underline cursor-pointer">politique de confidentialite</span> d'OFS Elite.
                  </p>
                </label>

                {error && <p className="text-[8px] font-bold text-red-400 bg-red-500/8 border border-red-500/20 p-2 rounded-lg text-center uppercase">{error}</p>}

                <NavBtns onBack={() => setVStep(4)} onNext={handleVendorSubmit} nextLabel="Soumettre la demande" nextDisabled={!rgpdOk} loading={loading} />
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-[7px] font-bold text-zinc-700 leading-relaxed">
            OneFreestyle Elite - Verification KYC conforme a la loi camerounaise N 2010/012 - support@onefreestyle.cm
          </p>
          <p className="mt-3 text-center text-[9px] font-bold text-zinc-600">
            Deja inscrit ?{' '}
            <Link to="/login" className="text-primary border-b border-primary pb-0.5 ml-1 hover:text-white transition">Se connecter</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── MEMBER FLOW ─────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-white flex overflow-hidden font-sans select-none">

      {/* Panel gauche */}
      <div className="hidden lg:flex lg:w-[40%] relative flex-col justify-between p-10 overflow-hidden bg-[#0a0a0a] border-r border-zinc-800">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80"
            className="w-full h-full object-cover opacity-20 grayscale transition-transform duration-[20s] hover:scale-110" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>
        <Link to="/" className="relative z-10 flex items-center gap-2">
          <img src={ofsLogo} alt="Logo" className="w-6 h-6 object-contain invert" />
          <span className="text-white text-xs font-black tracking-[0.3em] uppercase italic">OFS Elite</span>
        </Link>
        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold text-white tracking-tighter leading-tight">
            The Access<br /><span className="text-primary italic">Redefined.</span>
          </h2>
          {refStatus === 'valid' && refOwner && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5"><Ico.Gift /><span className="text-primary text-[8px] font-black uppercase tracking-widest">Offre Parrainage Active</span></div>
              <p className="text-white/70 text-[9px] leading-relaxed">Invite par <span className="text-white font-bold">{refOwner.full_name}</span> — recevez <span className="text-primary font-black">+50 pts</span> a l'inscription.</p>
            </div>
          )}
          <div className="space-y-1.5">
            {['Standard de Qualite Global', 'Reseau de Logistique Integree', 'Securite Transactionnelle SSL'].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                <Ico.Check /> {t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <div className="h-[1px] w-6 bg-primary mb-2" />
          <p className="text-zinc-600 text-[8px] font-bold tracking-[0.4em] uppercase">2026 OFS System</p>
        </div>
      </div>

      {/* Panel droit */}
      <div className="w-full lg:w-[60%] h-full flex flex-col justify-center items-center bg-white p-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
          <img src={ofsLogo} alt="" className="w-96 h-96 object-contain" />
        </div>
        <div className="w-full max-w-[320px] z-10">
          <header className="mb-6 text-center lg:text-left">
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-zinc-900 leading-none">Create Profile</h1>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.3em] mt-1">Marketplace Tier-1 Protocol</p>
          </header>

          {/* Selector */}
          <div className="flex bg-zinc-50 p-1 rounded-xl mb-5 border border-zinc-100">
            {['member','vendor'].map(f => (
              <button key={f} onClick={() => setFlow(f)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${flow === f ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100' : 'text-zinc-400 hover:text-zinc-500'}`}>
                {f === 'member' ? <Ico.User /> : <Ico.Business />}
                {f === 'member' ? 'Personal' : 'Business'}
              </button>
            ))}
          </div>

          <form onSubmit={handleMemberSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identity</label>
              <input type="text" required value={mForm.displayName} onChange={e => setMForm(p => ({ ...p, displayName: e.target.value }))}
                className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none transition-all placeholder:text-zinc-300"
                placeholder="NOM COMPLET" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Security Mail</label>
              <input type="email" required value={mForm.email} onChange={e => setMForm(p => ({ ...p, email: e.target.value }))}
                className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none transition-all placeholder:text-zinc-300"
                placeholder="PRO@OFS.CM" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['password','Key'],['confirm','Verify']].map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
                  <input type="password" required value={mForm[k]} onChange={e => setMForm(p => ({ ...p, [k]: e.target.value }))}
                    className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none transition-all"
                    placeholder="••••••••" />
                </div>
              ))}
            </div>

            <ReferralInput refInput={refInput} setRefInput={setRefInput} refStatus={refStatus} refOwner={refOwner} clearRef={clearRef} dark={false} />

            {error   && <p className="text-[8px] font-bold text-red-500 bg-red-50 p-2 rounded border border-red-100 text-center uppercase tracking-widest">{error}</p>}
            {success && <p className="text-[8px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100 text-center uppercase tracking-widest">{success}</p>}

            <button disabled={loading}
              className="w-full py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group shadow-lg active:scale-[0.97] mt-2 bg-zinc-900 text-white disabled:opacity-50">
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              {loading ? 'PROCESSING...' : 'INITIALIZE ACCESS'}
            </button>
          </form>

          <footer className="mt-5 text-center text-[9px] font-bold text-zinc-400 tracking-tight">
            ALREADY REGISTERED ?{' '}
            <Link to="/login" className="text-zinc-900 border-b border-primary pb-0.5 ml-1 hover:text-primary transition">SIGN IN</Link>
          </footer>
        </div>
      </div>
    </div>
  );
}