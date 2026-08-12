import React, { useState, useRef, useEffect, useCallback } from "react";

/* ════════════════════════════════════════════════════════════════════════════
   PHOTO PRISE EN DIRECT

   Une photo choisie dans la galerie ne vaut rien pour une vérification
   d'identité : n'importe qui envoie n'importe quel visage. La caméra, elle,
   oblige la personne à être devant l'écran au moment où on la photographie.

   Aucune détection biométrique n'est faite ici — les consignes de cadrage
   servent à obtenir une image nette, et c'est un humain qui compare ensuite
   la photo à la pièce d'identité.

   Le composant remonte un Blob JPEG. Il ne parle à aucune base : c'est
   l'écran qui l'accueille qui décide où l'envoyer.
   ════════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  { icon: "fa-crosshairs", label: "Centre ton visage",           color: "#2a78d6" },
  { icon: "fa-lightbulb",  label: "Place-toi dans la lumière",   color: "#B26200" },
  { icon: "fa-eye",        label: "Regarde l'objectif",          color: "#007600" },
  { icon: "fa-camera",     label: "Garde la position…",          color: "#FF9900" },
];

const LiveSelfie = ({ value, onCapture, accent = "#FF9900" }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState(value ? "done" : "intro");  // intro|stream|done|error
  const [idx,   setIdx]   = useState(0);
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Une caméra qu'on oublie d'éteindre laisse la diode allumée et vide la
  // batterie. On coupe au démontage, quoi qu'il arrive.
  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("stream"); setIdx(0);

      // Les consignes défilent d'elles-mêmes : personne ne lit quatre lignes
      // avant de se prendre en photo.
      let i = 0;
      const iv = setInterval(() => {
        i += 1;
        setIdx(Math.min(i, STEPS.length - 1));
        if (i >= STEPS.length - 1) clearInterval(iv);
      }, 1500);
    } catch {
      setError("Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, puis réessaie.");
      setPhase("error");
    }
  };

  // Le <video> n'existe qu'une fois la phase passée à « stream ».
  useEffect(() => {
    if (phase === "stream" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    if (!v.videoWidth) { setTimeout(capture, 200); return; }   // la vidéo n'est pas prête

    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const preview = c.toDataURL("image/jpeg", 0.85);
    c.toBlob(blob => onCapture?.({ blob, preview }), "image/jpeg", 0.85);
    setPhase("done");
    stop();
  };

  const retry = () => { onCapture?.(null); setPhase("intro"); setIdx(0); setError(""); };

  /* ── Photo prise ────────────────────────────────────────────────────── */
  if (phase === "done" && value?.preview) return (
    <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: "#007600" }}>
      <div className="relative">
        <img src={value.preview} alt="" className="w-full h-56 object-cover" />
        <span className="absolute bottom-3 left-3 bg-white/95 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg"
          style={{ color: "#007600" }}>
          <i className="fa-solid fa-check mr-1" />Photo prise
        </span>
      </div>
      <button type="button" onClick={retry}
        className="w-full py-2.5 text-[11px] font-black uppercase tracking-wider bg-[#F7F8F8] text-[#565959] hover:bg-[#EAEDED]">
        <i className="fa-solid fa-rotate-left mr-1.5" />Reprendre
      </button>
    </div>
  );

  /* ── Caméra ouverte ─────────────────────────────────────────────────── */
  if (phase === "stream") return (
    <div className="rounded-2xl overflow-hidden border-2" style={{ borderColor: accent }}>
      <div className="relative bg-black">
        {/* Miroir : on se reconnaît mieux inversé, comme dans une glace. */}
        <video ref={videoRef} autoPlay muted playsInline
          className="w-full h-56 object-cover scale-x-[-1]" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-36 h-44 rounded-[50%] border-2 border-white/70" />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 bg-black/60 rounded-xl px-3 py-2">
          <i className={`fa-solid ${STEPS[idx].icon} text-[13px]`} style={{ color: STEPS[idx].color }} />
          <span className="text-white text-[12px] font-bold">{STEPS[idx].label}</span>
        </div>
      </div>
      <button type="button" onClick={capture}
        className="w-full py-3 text-[12px] font-black uppercase tracking-wider text-white"
        style={{ background: accent }}>
        <i className="fa-solid fa-camera mr-1.5" />Capturer
      </button>
    </div>
  );

  /* ── Avant, ou après un refus ───────────────────────────────────────── */
  return (
    <div className="rounded-2xl border-2 border-dashed p-6 text-center" style={{ borderColor: "#D5D9D9" }}>
      <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
        style={{ background: "#F7F8F8" }}>
        <i className="fa-solid fa-user-check text-xl" style={{ color: accent }} />
      </div>
      <p className="font-bold text-[14px] mb-1" style={{ color: "#0F1111" }}>Photo de vérification</p>
      <p className="text-[12px] leading-snug mb-4" style={{ color: "#565959" }}>
        Elle est prise maintenant, avec ta caméra — pas choisie dans ta galerie.
        Buyticle la compare à ta pièce d'identité.
      </p>
      {error && (
        <p className="text-[11px] font-bold mb-3" style={{ color: "#B12704" }}>
          <i className="fa-solid fa-circle-exclamation mr-1.5" />{error}
        </p>
      )}
      <button type="button" onClick={start}
        className="px-5 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider text-white"
        style={{ background: accent }}>
        <i className="fa-solid fa-camera mr-1.5" />
        {phase === "error" ? "Réessayer" : "Ouvrir la caméra"}
      </button>
    </div>
  );
};

export default LiveSelfie;
