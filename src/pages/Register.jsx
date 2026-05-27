import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ofsLogo from '../assets/ofs.png';

// ─── PLANS ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 0, period: 'Gratuit', badge: null,
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
    id: 'pro', name: 'Pro', price: 5000, period: '/ mois', badge: 'Populaire',
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
    id: 'elite', name: 'Elite', price: 15000, period: '/ mois', badge: 'Max',
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
  { id: 'center',  icon: 'fa-crosshairs', label: 'Centrez votre visage',        color: 'text-blue-500'   },
  { id: 'blink',   icon: 'fa-eye-slash',  label: 'Clignez des yeux 2x',         color: 'text-yellow-600' },
  { id: 'smile',   icon: 'fa-face-smile', label: 'Souriez',                     color: 'text-green-600'  },
  { id: 'left',    icon: 'fa-arrow-left', label: 'Tournez légèrement à gauche', color: 'text-purple-600' },
  { id: 'capture', icon: 'fa-camera',     label: 'Maintenez la position...',    color: 'text-[#FF9900]'  },
];

const SHOP_CATEGORIES = [
  'Audio Lab', 'Mode Femme', 'Sneakers', 'Streetwear',
  'Tech Lab', 'Parfums', 'Accessories', 'Divers',
];

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Ico = {
  User:     () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  Business: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745V20a2 2 0 002 2h14a2 2 0 002-2v-6.745zM16 8V5a2 2 0 00-2-2H10a2 2 0 00-2 2v3H4a2 2 0 00-2 2v3a2 2 0 002 2h16a2 2 0 002-2v-3a2 2 0 00-2-2h-4zM10 8h4V5h-4v3z"/></svg>,
  Check:    () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>,
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
      className={`relative border-2 border-dashed rounded transition-all duration-200 cursor-pointer ${drag ? 'border-[#FF9900] bg-[#FF9900]/5' : preview ? 'border-[#FF9900]/50' : 'border-[#D5D9D9] hover:border-[#FF9900]'}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files[0] && onChange(e.target.files[0])} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="" className="w-full h-28 object-cover rounded" />
          <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-bold uppercase text-white bg-black/60 px-2 py-1 rounded">Changer</span>
          </div>
          <div className="absolute top-1.5 right-1.5 bg-[#FF9900] text-[#0F1111] text-[8px] font-bold px-1.5 py-0.5 rounded">OK</div>
        </div>
      ) : (
        <div className="py-6 text-center px-3">
          <i className="fa-solid fa-cloud-arrow-up text-[#adb5bd] text-2xl mb-2 block"></i>
          <p className="font-bold text-[11px] text-[#0F1111]">{label}</p>
          <p className="text-[10px] text-[#565959] mt-0.5">{sub}</p>
          <p className="text-[9px] text-[#adb5bd] mt-0.5">JPG / PNG / PDF — Max 5MB</p>
        </div>
      )}
    </div>
  );
};

// ─── STEPPER ─────────────────────────────────────────────────────────────────
const VendorStepper = ({ steps, currentIndex }) => (
  <div className="relative mb-6">
    <div className="absolute top-4 left-0 right-0 h-px bg-[#D5D9D9]" />
    <div className="flex items-start justify-between relative">
      {steps.map((s, i) => {
        const done = i < currentIndex, active = i === currentIndex;
        return (
          <div key={s.key} className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${done ? 'bg-[#FF9900] border-[#FF9900]' : active ? 'bg-[#FF9900]/10 border-[#FF9900]' : 'bg-white border-[#D5D9D9]'}`}>
              {done
                ? <i className="fa-solid fa-check text-[#0F1111] text-[9px]"></i>
                : <i className={`fa-solid ${s.icon} text-[9px] ${active ? 'text-[#FF9900]' : 'text-[#adb5bd]'}`}></i>}
            </div>
            <span className={`text-[7px] font-bold uppercase tracking-widest whitespace-nowrap hidden sm:block ${active ? 'text-[#FF9900]' : done ? 'text-[#565959]' : 'text-[#adb5bd]'}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── NAV BUTTONS ─────────────────────────────────────────────────────────────
const NavBtns = ({ onBack, onNext, nextLabel = 'Continuer', nextDisabled = false, loading = false }) => (
  <div className="flex justify-between pt-4 border-t border-[#D5D9D9] mt-2">
    {onBack
      ? <button type="button" onClick={onBack} className="flex items-center gap-2 border border-[#D5D9D9] text-[#565959] px-5 py-2.5 rounded font-bold text-sm hover:border-[#adb5bd] transition">
          <i className="fa-solid fa-arrow-left text-xs"></i> Retour
        </button>
      : <div />}
    <button type="button" onClick={onNext} disabled={nextDisabled || loading}
      className="flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-7 py-2.5 rounded font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
      {loading ? <><i className="fa-solid fa-spinner fa-spin text-xs"></i> Traitement...</> : <>{nextLabel} <i className="fa-solid fa-arrow-right text-xs"></i></>}
    </button>
  </div>
);

// ─── REFERRAL INPUT ───────────────────────────────────────────────────────────
const ReferralInput = ({ refInput, setRefInput, refStatus, refOwner, clearRef }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#565959] flex items-center gap-1.5">
        <Ico.Gift /> Code Parrainage <span className="text-[#adb5bd] normal-case font-normal">(optionnel)</span>
      </label>
      {refStatus === 'valid' && <span className="text-[10px] font-bold text-[#007600]">+50 pts offerts</span>}
    </div>
    <div className="relative">
      <input
        type="text" value={refInput} onChange={e => setRefInput(e.target.value)}
        className={`w-full border rounded px-3 py-2.5 text-sm font-bold outline-none transition-all uppercase tracking-wider placeholder:normal-case placeholder:text-[#adb5bd]
          ${refStatus === 'valid' ? 'border-[#007600] bg-green-50/30 text-[#007600]' : refStatus === 'invalid' ? 'border-red-300 bg-red-50/30 text-red-600' : 'border-[#D5D9D9] text-[#0F1111] focus:border-[#FF9900]'}`}
        placeholder="OFS-XXXXXX" maxLength={12}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {refStatus === 'checking' && <div className="w-3 h-3 border-2 border-[#D5D9D9] border-t-[#FF9900] rounded-full animate-spin" />}
        {refStatus === 'valid'    && <div className="w-4 h-4 bg-[#007600] rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg></div>}
        {refStatus === 'invalid'  && <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center cursor-pointer" onClick={clearRef}><Ico.X /></div>}
      </div>
    </div>
    {refStatus === 'valid' && refOwner && (
      <div className="flex items-center justify-between rounded px-2.5 py-2 border bg-green-50 border-green-100">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-[#FF9900] rounded-full flex items-center justify-center flex-shrink-0"><Ico.Star /></div>
          <span className="text-[10px] font-bold text-green-800">Parrainé par <span className="text-[#0F1111]">{refOwner.full_name}</span></span>
        </div>
        <button type="button" onClick={clearRef} className="text-[#adb5bd] hover:text-[#565959] transition"><Ico.X /></button>
      </div>
    )}
    {refStatus === 'invalid' && refInput.length > 0 && <p className="text-[10px] font-bold ml-1 text-red-500">Code introuvable. Vérifiez et réessayez.</p>}
  </div>
);

// ─── FIELD INPUT ─────────────────────────────────────────────────────────────
const Field = ({ label, icon, ...props }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">{label}</label>
    <div className="relative">
      {icon && <i className={`fa-solid ${icon} absolute left-3 top-1/2 -translate-y-1/2 text-[#adb5bd] text-sm`}></i>}
      <input
        className={`w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] transition-colors`}
        {...props}
      />
    </div>
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
    } catch (e) { setCamError("Accès à la caméra refusé. Autorisez l'accès dans les paramètres du navigateur."); setLivenessPhase('error'); }
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

  const vValid = [
    !!(vForm.email && vForm.password && vForm.confirm && vForm.password === vForm.confirm),
    !!(vForm.shop_name && vForm.full_name && vForm.phone && vForm.category),
    !!vForm.plan,
    !!(vForm.id_type && vForm.id_front && vForm.id_back),
    !!selfieUrl,
    rgpdOk,
  ];

  async function handleMemberSubmit(e) {
    e.preventDefault(); setError('');
    if (mForm.password !== mForm.confirm) return setError('Mots de passe non identiques.');
    setLoading(true);
    try {
      const result = await signUpMember(mForm.email, mForm.password, mForm.displayName);
      const uid = result?.user?.id ?? result?.id ?? null;
      if (uid && refStatus === 'valid' && refOwner) { await processReferral(refOwner.id, uid); localStorage.removeItem('ofs_referral_code'); }
      setSuccess('Profil créé ! Vérifiez votre boîte mail.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

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

  // ─── SUCCESS PAGE ────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#EAEDED] flex items-center justify-center px-4">
        <div className="bg-white border border-[#D5D9D9] rounded p-10 max-w-sm w-full text-center shadow-sm">
          <div className="w-16 h-16 bg-[#FF9900]/10 border-2 border-[#FF9900]/30 rounded-full flex items-center justify-center mx-auto mb-5">
            <i className="fa-solid fa-paper-plane text-[#FF9900] text-2xl"></i>
          </div>
          <h2 className="font-bold text-2xl text-[#0F1111] mb-2">Demande soumise !</h2>
          <p className="text-[#565959] text-sm mb-1 leading-relaxed">
            Votre dossier est en cours d'examen. Réponse par email dans <strong className="text-[#0F1111]">24 à 48h</strong>.
          </p>
          <p className="text-[#565959] text-xs mb-6">Plan choisi : <span className="text-[#FF9900] font-bold uppercase">{vForm.plan}</span></p>
          <div className="flex flex-col gap-2">
            <Link to="/" className="flex items-center justify-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-8 py-3 rounded font-bold text-sm transition">
              <i className="fa-solid fa-house text-xs"></i> Retour à l'accueil
            </Link>
            <Link to="/login" className="flex items-center justify-center gap-2 border border-[#D5D9D9] text-[#565959] hover:border-[#adb5bd] px-8 py-3 rounded font-bold text-sm transition">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── VENDOR FLOW ────────────────────────────────────────────────
  if (flow === 'vendor') {
    return (
      <div className="min-h-screen bg-[#EAEDED] text-[#0F1111]">

        {/* Amazon-style top nav */}
        <header className="bg-[#131921] px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={ofsLogo} alt="Logo" className="w-6 h-6 object-contain invert" />
            <span className="text-white text-sm font-bold">One<span className="text-[#FF9900]">Freestyle</span></span>
          </Link>
          <button onClick={() => { setFlow('member'); setVStep(0); setError(''); }}
            className="flex items-center gap-2 text-[#adb5bd] hover:text-white text-xs font-bold transition">
            <Ico.X /> Annuler
          </button>
        </header>

        <div className="max-w-[700px] mx-auto px-4 py-8">

          {/* Page title */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-[#FF9900]/10 border border-[#FF9900]/30 rounded flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-store text-[#FF9900] text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#0F1111] leading-none">Ouvrir une Boutique Elite</h1>
                <p className="text-[#565959] text-xs mt-0.5">KYC requis · Données chiffrées AES-256</p>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <VendorStepper steps={VENDOR_STEPS} currentIndex={vStep} />

          {/* Step card */}
          <div className="bg-white border border-[#D5D9D9] rounded p-6 shadow-sm">

            {/* ── STEP 0 — COMPTE ── */}
            {vStep === 0 && (
              <div className="space-y-5">
                <div className="pb-4 border-b border-[#D5D9D9]">
                  <h2 className="text-lg font-bold text-[#0F1111] mb-1">Créez votre accès</h2>
                  <p className="text-[#565959] text-sm">Email et mot de passe pour vous connecter à votre boutique.</p>
                </div>
                <div className="space-y-4">
                  <Field label="Email professionnel *" icon="fa-envelope" type="email" value={vForm.email}
                    onChange={e => setVF('email', e.target.value)} placeholder="pro@boutique.cm" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Mot de passe *" type="password" value={vForm.password}
                      onChange={e => setVF('password', e.target.value)} placeholder="••••••••" />
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">Confirmer *</label>
                      <input type="password" value={vForm.confirm} onChange={e => setVF('confirm', e.target.value)}
                        className={`w-full border rounded px-3 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] outline-none transition-colors ${vForm.confirm && vForm.confirm !== vForm.password ? 'border-red-300 focus:border-red-400' : 'border-[#D5D9D9] focus:border-[#FF9900]'}`}
                        placeholder="••••••••" />
                    </div>
                  </div>
                  {vForm.confirm && vForm.confirm !== vForm.password && (
                    <p className="text-sm text-red-500 font-bold">Mots de passe non identiques.</p>
                  )}
                  <ReferralInput refInput={refInput} setRefInput={setRefInput} refStatus={refStatus} refOwner={refOwner} clearRef={clearRef} />
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded text-center">{error}</p>}
                <NavBtns onNext={() => { setError(''); setVStep(1); }} nextDisabled={!vValid[0]} />
              </div>
            )}

            {/* ── STEP 1 — BOUTIQUE ── */}
            {vStep === 1 && (
              <div className="space-y-5">
                <div className="pb-4 border-b border-[#D5D9D9]">
                  <h2 className="text-lg font-bold text-[#0F1111] mb-1">Infos de la boutique</h2>
                  <p className="text-[#565959] text-sm">Ces informations seront visibles par vos clients.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nom boutique *" icon="fa-store"        type="text"  value={vForm.shop_name || ''} onChange={e => setVF('shop_name', e.target.value)} placeholder="Ex: SoundElite" />
                  <Field label="Nom du gérant *" icon="fa-user"        type="text"  value={vForm.full_name || ''} onChange={e => setVF('full_name', e.target.value)} placeholder="Nom et prénom" />
                  <Field label="Téléphone *"     icon="fa-phone"       type="tel"   value={vForm.phone || ''}     onChange={e => setVF('phone', e.target.value)}     placeholder="+237 6XX XXX XXX" />
                  <Field label="Ville"           icon="fa-location-dot" type="text" value={vForm.city || ''}      onChange={e => setVF('city', e.target.value)}      placeholder="Douala" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-2">Catégorie *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SHOP_CATEGORIES.map(cat => (
                      <button key={cat} type="button" onClick={() => setVF('category', cat)}
                        className={`py-2 px-3 rounded border-2 text-xs font-bold transition-all ${vForm.category === cat ? 'border-[#232F3E] bg-[#232F3E] text-[#FF9900]' : 'border-[#D5D9D9] text-[#565959] bg-white hover:border-[#FF9900] hover:text-[#FF9900]'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">Description</label>
                  <textarea value={vForm.description || ''} onChange={e => setVF('description', e.target.value)} rows={3}
                    placeholder="Décrivez votre boutique, vos produits..."
                    className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] transition-colors resize-none" />
                </div>
                <NavBtns onBack={() => setVStep(0)} onNext={() => setVStep(2)} nextDisabled={!vValid[1]} />
              </div>
            )}

            {/* ── STEP 2 — PLAN ── */}
            {vStep === 2 && (
              <div className="space-y-5">
                <div className="pb-4 border-b border-[#D5D9D9]">
                  <h2 className="text-lg font-bold text-[#0F1111] mb-1">Choisissez votre plan</h2>
                  <p className="text-[#565959] text-sm">Modifiable à tout moment depuis votre dashboard.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLANS.map(plan => {
                    const sel = vForm.plan === plan.id;
                    return (
                      <button key={plan.id} type="button" onClick={() => setVF('plan', plan.id)}
                        className={`relative text-left rounded border-2 p-4 flex flex-col gap-3 transition-all bg-white hover:border-[#FF9900] ${sel ? 'border-[#232F3E] shadow-md' : 'border-[#D5D9D9]'}`}>
                        {plan.badge && (
                          <span className={`absolute -top-2.5 left-4 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${plan.id === 'pro' ? 'bg-[#FF9900]/10 text-[#FF9900] border-[#FF9900]/30' : 'bg-[#FFD814]/20 text-yellow-700 border-yellow-300'}`}>
                            {plan.badge}
                          </span>
                        )}
                        {sel && (
                          <div className="absolute top-3 right-3 w-5 h-5 bg-[#FF9900] rounded-full flex items-center justify-center">
                            <i className="fa-solid fa-check text-[#0F1111] text-[8px]"></i>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-0.5">{plan.name}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-[#0F1111]">{plan.price === 0 ? '0' : plan.price.toLocaleString()}</span>
                            <span className="text-xs text-[#565959]">FCFA {plan.period}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {plan.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <i className={`fa-solid ${f.ok ? 'fa-check text-[#007600]' : 'fa-xmark text-[#adb5bd]'} text-[10px] flex-shrink-0`}></i>
                              <span className={`text-[11px] ${f.ok ? 'text-[#0F1111]' : 'text-[#adb5bd]'}`}>{f.text}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded p-3 flex items-start gap-2">
                  <i className="fa-solid fa-circle-info text-blue-500 text-sm flex-shrink-0 mt-0.5"></i>
                  <p className="text-sm text-[#565959]">Le paiement se fait après validation de votre identité. Vous pouvez commencer avec le plan Gratuit et upgrader à tout moment.</p>
                </div>
                <NavBtns onBack={() => setVStep(1)} onNext={() => setVStep(3)} nextDisabled={!vValid[2]} />
              </div>
            )}

            {/* ── STEP 3 — IDENTITÉ ── */}
            {vStep === 3 && (
              <div className="space-y-5">
                <div className="pb-4 border-b border-[#D5D9D9]">
                  <h2 className="text-lg font-bold text-[#0F1111] mb-1">Vérification d'identité</h2>
                  <p className="text-[#565959] text-sm">Documents chiffrés — supprimés après validation.</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded p-4 flex items-start gap-3">
                  <i className="fa-solid fa-shield-halved text-blue-500 text-sm flex-shrink-0 mt-0.5"></i>
                  <p className="text-sm text-[#565959] leading-relaxed">Vos documents sont stockés sur un serveur chiffré AES-256, accessibles uniquement par notre équipe. Conforme à la loi camerounaise N°2010/012.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-2">Type de document *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ID_TYPES.map(t => (
                      <button key={t.value} type="button" onClick={() => setVF('id_type', t.value)}
                        className={`py-3 px-3 rounded border-2 text-xs font-bold uppercase text-center transition-all ${vForm.id_type === t.value ? 'border-[#232F3E] bg-[#232F3E] text-[#FF9900]' : 'border-[#D5D9D9] text-[#565959] bg-white hover:border-[#FF9900]'}`}>
                        {t.short}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">
                      <span className="text-[#FF9900]">+</span> Recto *
                    </label>
                    <UploadZone label="Face avant" sub="Avec votre photo" onChange={f => handleDocFile('front', f)} preview={frontPreview} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">
                      <span className="text-[#FF9900]">+</span> Verso *
                    </label>
                    <UploadZone label="Face arrière" sub="Dos du document" onChange={f => handleDocFile('back', f)} preview={backPreview} />
                  </div>
                </div>
                <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[['fa-sun','Bonne lumière'],['fa-eye','Texte lisible'],['fa-crop','Doc entier'],['fa-hand','Pas de reflet']].map(([icon, label]) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#FF9900]/10 rounded flex items-center justify-center flex-shrink-0">
                        <i className={`fa-solid ${icon} text-[#FF9900] text-[10px]`}></i>
                      </div>
                      <span className="text-xs text-[#565959]">{label}</span>
                    </div>
                  ))}
                </div>
                <NavBtns onBack={() => setVStep(2)} onNext={() => setVStep(4)} nextDisabled={!vValid[3]} />
              </div>
            )}

            {/* ── STEP 4 — LIVENESS ── */}
            {vStep === 4 && (
              <div className="space-y-5">
                <div className="pb-4 border-b border-[#D5D9D9]">
                  <h2 className="text-lg font-bold text-[#0F1111] mb-1">Vérification faciale en direct</h2>
                  <p className="text-[#565959] text-sm">Un selfie guidé pour confirmer que vous êtes le détenteur du document.</p>
                </div>

                {livenessPhase === 'intro' && !selfieUrl && (
                  <div className="space-y-4">
                    <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded overflow-hidden">
                      <div className="p-4 border-b border-[#D5D9D9] space-y-2.5">
                        {LIVENESS_STEPS.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-white border border-[#D5D9D9] rounded flex items-center justify-center flex-shrink-0">
                              <i className={`fa-solid ${s.icon} ${s.color} text-xs`}></i>
                            </div>
                            <p className="text-sm text-[#565959]">{i + 1}. {s.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 grid grid-cols-3 gap-3">
                        {[['fa-lightbulb','Bonne lumière','Face à une fenêtre'],['fa-glasses','Lunettes OK','Pas de masque'],['fa-wifi','Connexion stable','WiFi recommandé']].map(([icon, label, sub]) => (
                          <div key={label} className="text-center">
                            <div className="w-9 h-9 bg-[#FF9900]/10 border border-[#FF9900]/20 rounded flex items-center justify-center mx-auto mb-1.5">
                              <i className={`fa-solid ${icon} text-[#FF9900] text-sm`}></i>
                            </div>
                            <p className="text-xs font-bold text-[#0F1111]">{label}</p>
                            <p className="text-[10px] text-[#565959]">{sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={startCamera}
                      className="w-full flex items-center justify-center gap-3 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] py-3.5 rounded font-bold text-sm transition active:scale-95">
                      <i className="fa-solid fa-camera text-sm"></i> Démarrer la vérification
                    </button>
                  </div>
                )}

                {livenessPhase === 'stream' && (
                  <div className="space-y-3">
                    <div className="relative bg-black rounded overflow-hidden aspect-video">
                      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-52 border-4 border-[#FF9900]/70 rounded-full opacity-80" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
                      </div>
                      <div className="absolute top-3 left-0 right-0 flex justify-center">
                        <div className={`flex items-center gap-2 bg-black/70 border border-white/20 px-3 py-2 rounded-full text-white ${currentLivenessStep.color}`}>
                          <i className={`fa-solid ${currentLivenessStep.icon} text-sm`}></i>
                          <span className="text-xs font-bold">{currentLivenessStep.label}</span>
                        </div>
                      </div>
                      {countdown !== null && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                          <div className="text-7xl font-bold text-[#FF9900] animate-pulse">{countdown}</div>
                        </div>
                      )}
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                        {LIVENESS_STEPS.map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i <= livenessIdx ? 'bg-[#FF9900] scale-125' : 'bg-white/30'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[#565959] text-center">Suivez les instructions — Capture automatique</p>
                  </div>
                )}

                {(livenessPhase === 'done' || selfieUrl) && selfieUrl && (
                  <div className="space-y-3">
                    <div className="relative rounded overflow-hidden">
                      <img src={selfieUrl} alt="Selfie" className="w-full max-h-64 object-cover scale-x-[-1]" />
                      <div className="absolute top-2.5 right-2.5 bg-[#FF9900] text-[#0F1111] text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1">
                        <i className="fa-solid fa-check text-xs"></i> Selfie capturé
                      </div>
                    </div>
                    <button onClick={retryLiveness}
                      className="w-full flex items-center justify-center gap-2 border border-[#D5D9D9] text-[#565959] py-2.5 rounded font-bold text-sm hover:border-[#FF9900] hover:text-[#FF9900] transition">
                      <i className="fa-solid fa-rotate-left text-xs"></i> Reprendre le selfie
                    </button>
                  </div>
                )}

                {livenessPhase === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded p-5 text-center">
                    <i className="fa-solid fa-camera-slash text-red-400 text-2xl mb-2 block"></i>
                    <p className="font-bold text-red-600 text-sm mb-1">Accès caméra requis</p>
                    <p className="text-xs text-[#565959] mb-4">{camError}</p>
                    <button onClick={startCamera}
                      className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-5 py-2 rounded font-bold text-sm transition">
                      Réessayer
                    </button>
                  </div>
                )}

                {livenessPhase !== 'stream' && <canvas ref={canvasRef} className="hidden" />}
                <NavBtns onBack={() => setVStep(3)} onNext={() => setVStep(5)} nextDisabled={!vValid[4]} />
              </div>
            )}

            {/* ── STEP 5 — RÉCAPITULATIF ── */}
            {vStep === 5 && (
              <div className="space-y-5">
                <div className="pb-4 border-b border-[#D5D9D9]">
                  <h2 className="text-lg font-bold text-[#0F1111] mb-1">Récapitulatif</h2>
                  <p className="text-[#565959] text-sm">Vérifiez vos informations avant de soumettre.</p>
                </div>
                <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded overflow-hidden divide-y divide-[#D5D9D9]">
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-3">Boutique</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[['Nom', vForm.shop_name],['Gérant', vForm.full_name],['Téléphone', vForm.phone],['Ville', vForm.city],['Catégorie', vForm.category],['Plan', vForm.plan.toUpperCase()]].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[10px] text-[#565959] font-bold uppercase">{k}</p>
                          <p className="text-sm font-bold text-[#0F1111] mt-0.5">{v || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-0.5">Plan choisi</p>
                      <p className="font-bold text-[#FF9900] text-base uppercase">{PLANS.find(p => p.id === vForm.plan)?.name}</p>
                    </div>
                    <p className="font-bold text-[#0F1111] text-lg">{vForm.plan === 'starter' ? 'Gratuit' : `${PLANS.find(p=>p.id===vForm.plan)?.price?.toLocaleString()} FCFA/mois`}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-3">Documents soumis</p>
                    <div className="flex gap-4">
                      {[['fa-id-card','Recto'],['fa-id-card','Verso'],['fa-face-smile','Selfie']].map(([icon, label], i) => (
                        <div key={label} className="text-center">
                          {i === 2 && selfieUrl
                            ? <img src={selfieUrl} alt="" className="w-10 h-10 object-cover rounded mx-auto mb-1 scale-x-[-1]" />
                            : <div className="w-10 h-10 bg-[#FF9900]/10 border border-[#FF9900]/20 rounded flex items-center justify-center mx-auto mb-1"><i className={`fa-solid ${icon} text-[#FF9900] text-sm`}></i></div>}
                          <p className="text-[9px] font-bold text-[#FF9900] uppercase">{label} ✓</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-3">Prochaines étapes</p>
                    <div className="space-y-2.5">
                      {[
                        ['fa-paper-plane','Soumission','Maintenant','text-[#FF9900]'],
                        ['fa-eye','Vérification identité','24–48h','text-blue-500'],
                        ['fa-store','Activation boutique','Après validation','text-yellow-600'],
                        ['fa-credit-card','Paiement plan','Si Pro / Elite','text-purple-500']
                      ].map(([icon,label,time,color]) => (
                        <div key={label} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-white border border-[#D5D9D9] rounded flex items-center justify-center flex-shrink-0">
                            <i className={`fa-solid ${icon} ${color} text-xs`}></i>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#0F1111]">{label}</p>
                            <p className="text-[10px] text-[#565959]">{time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer p-3 bg-[#F3F4F4] border border-[#D5D9D9] rounded hover:border-[#FF9900] transition">
                  <input type="checkbox" checked={rgpdOk} onChange={e => setRgpdOk(e.target.checked)}
                    className="w-4 h-4 mt-0.5 flex-shrink-0 accent-[#FF9900]" />
                  <p className="text-sm text-[#565959] leading-relaxed">
                    J'atteste que les informations sont exactes et que les documents m'appartiennent. J'accepte les{' '}
                    <span className="text-[#007185] underline cursor-pointer">conditions d'utilisation</span> et la{' '}
                    <span className="text-[#007185] underline cursor-pointer">politique de confidentialité</span> d'OFS Elite.
                  </p>
                </label>

                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded text-center">{error}</p>}
                <NavBtns onBack={() => setVStep(4)} onNext={handleVendorSubmit} nextLabel="Soumettre la demande" nextDisabled={!rgpdOk} loading={loading} />
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-[#565959]">
            OneFreestyle Elite · Vérification KYC conforme à la loi camerounaise N°2010/012 · support@onefreestyle.cm
          </p>
          <p className="mt-2 text-center text-sm text-[#565959]">
            Déjà inscrit ?{' '}
            <Link to="/login" className="text-[#007185] hover:text-[#C45500] hover:underline ml-1">Se connecter</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── MEMBER FLOW ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-[#EAEDED] flex overflow-hidden font-sans select-none">

      {/* Panel gauche — Amazon navy */}
      <div className="hidden lg:flex lg:w-[38%] relative flex-col justify-between p-10 overflow-hidden bg-[#131921]">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80"
            className="w-full h-full object-cover opacity-10 grayscale" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#131921] via-[#131921]/60 to-transparent" />
        </div>
        <Link to="/" className="relative z-10 flex items-center gap-2">
          <img src={ofsLogo} alt="Logo" className="w-6 h-6 object-contain invert" />
          <span className="text-white text-sm font-bold tracking-wide">One<span className="text-[#FF9900]">Freestyle</span></span>
        </Link>
        <div className="relative z-10 space-y-5">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Rejoignez<br /><span className="text-[#FF9900]">l'élite.</span>
          </h2>
          {refStatus === 'valid' && refOwner && (
            <div className="bg-[#FF9900]/10 border border-[#FF9900]/30 rounded p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Ico.Gift />
                <span className="text-[#FF9900] text-xs font-bold uppercase tracking-widest">Offre Parrainage Active</span>
              </div>
              <p className="text-[#ADBAC7] text-xs leading-relaxed">
                Invité par <span className="text-white font-bold">{refOwner.full_name}</span> — recevez <span className="text-[#FF9900] font-bold">+50 pts</span> à l'inscription.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {['Qualité Elite Certifiée', 'Livraison Express Douala', 'Paiement Sécurisé SSL'].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[#ADBAC7] text-sm">
                <i className="fa-solid fa-check text-[#FF9900] text-xs"></i> {t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <div className="h-px w-8 bg-[#FF9900] mb-2" />
          <p className="text-[#37475A] text-xs tracking-widest uppercase">© 2026 OFS System</p>
        </div>
      </div>

      {/* Panel droit */}
      <div className="w-full lg:w-[62%] flex flex-col justify-center items-center bg-white p-6 relative overflow-y-auto">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-6">
            <img src={ofsLogo} alt="Logo" className="w-6 h-6 object-contain" />
            <span className="text-[#0F1111] text-sm font-bold">One<span className="text-[#FF9900]">Freestyle</span></span>
          </div>

          <header className="mb-6">
            <h1 className="text-2xl font-bold text-[#0F1111] leading-none mb-1">Créer un compte</h1>
            <p className="text-sm text-[#565959]">Accès gratuit · Avantages membres immédiats</p>
          </header>

          {/* Type selector */}
          <div className="flex bg-[#F3F4F4] p-1 rounded border border-[#D5D9D9] mb-5">
            {[
              { key: 'member',  label: 'Client',   icon: <Ico.User />,     desc: 'Acheter & profiter' },
              { key: 'vendor',  label: 'Vendeur',  icon: <Ico.Business />, desc: 'Vendre sur OFS'    },
            ].map(f => (
              <button key={f.key} onClick={() => f.key === 'vendor' ? setFlow('vendor') : setFlow('member')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-sm font-bold transition-all ${flow === f.key ? 'bg-white text-[#0F1111] shadow border border-[#D5D9D9]' : 'text-[#565959] hover:text-[#0F1111]'}`}>
                {f.icon}
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleMemberSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">Nom complet *</label>
              <input type="text" required value={mForm.displayName}
                onChange={e => setMForm(p => ({ ...p, displayName: e.target.value }))}
                className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] transition-colors"
                placeholder="Votre nom et prénom" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">Adresse email *</label>
              <input type="email" required value={mForm.email}
                onChange={e => setMForm(p => ({ ...p, email: e.target.value }))}
                className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] transition-colors"
                placeholder="votre@email.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['password','Mot de passe *'],['confirm','Confirmer *']].map(([k, label]) => (
                <div key={k}>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">{label}</label>
                  <input type="password" required value={mForm[k]}
                    onChange={e => setMForm(p => ({ ...p, [k]: e.target.value }))}
                    className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2.5 text-sm text-[#0F1111] transition-colors"
                    placeholder="••••••••" />
                </div>
              ))}
            </div>

            <ReferralInput refInput={refInput} setRefInput={setRefInput} refStatus={refStatus} refOwner={refOwner} clearRef={clearRef} />

            {error   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded text-center">{error}</p>}
            {success && <p className="text-sm text-[#007600] bg-green-50 border border-green-200 p-3 rounded text-center">{success}</p>}

            <button disabled={loading}
              className="w-full py-3.5 rounded font-bold text-sm transition-all bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] shadow-sm active:scale-[0.98] disabled:opacity-50 mt-1">
              {loading ? 'Création en cours...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-xs text-[#565959] mt-3 text-center leading-relaxed">
            En créant un compte, vous acceptez nos{' '}
            <span className="text-[#007185] underline cursor-pointer">conditions d'utilisation</span>.
          </p>

          <div className="mt-5 pt-5 border-t border-[#D5D9D9] text-center">
            <span className="text-sm text-[#565959]">Déjà un compte ? </span>
            <Link to="/login" className="text-sm text-[#007185] hover:text-[#C45500] hover:underline font-bold">Se connecter</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
