import React, { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, createLocalTracks } from "livekit-client";
import { LIVEKIT_ENABLED, getLiveToken } from "../lib/livekit";

// Diffuse (publish=true, l'hôte) ou lit (publish=false, spectateur) un live WebRTC.
// Se connecte uniquement quand `active`. Repli sur `poster` si LiveKit off / pas de flux.
export default function LiveVideo({ room: roomName, publish = false, active = true, poster, className = "" }) {
  const videoRef = useRef(null);
  const [state, setState]     = useState("idle"); // idle | connecting | live | error | off
  const [hasVideo, setHasVideo] = useState(false);
  const [muted, setMuted]     = useState(true);   // autoplay navigateur → démarre muet

  useEffect(() => {
    if (!LIVEKIT_ENABLED || !active || !roomName) { setState("off"); setHasVideo(false); return; }
    let cancelled = false;
    let room;

    (async () => {
      try {
        setState("connecting");
        const { token, url } = await getLiveToken(roomName, publish);
        room = new Room({ adaptiveStream: true, dynacast: true });

        const attach = (track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
            setHasVideo(true);
          }
        };

        room.on(RoomEvent.TrackSubscribed, attach);
        room.on(RoomEvent.TrackUnsubscribed, (track) => { try { track.detach(); } catch {} });
        room.on(RoomEvent.Disconnected, () => { if (!cancelled) { setHasVideo(false); setState("off"); } });

        await room.connect(url, token);
        if (cancelled) { room.disconnect(); return; }

        if (publish) {
          const tracks = await createLocalTracks({ audio: true, video: { facingMode: "user", resolution: { width: 720, height: 1280 } } });
          for (const t of tracks) {
            await room.localParticipant.publishTrack(t);
            if (t.kind === Track.Kind.Video && videoRef.current) { t.attach(videoRef.current); setHasVideo(true); }
          }
        } else {
          // rattrape les pistes déjà présentes
          room.remoteParticipants.forEach((p) =>
            p.trackPublications.forEach((pub) => { if (pub.track) attach(pub.track); })
          );
        }
        if (!cancelled) setState("live");
      } catch (e) {
        if (!cancelled) setState("error");
        console.warn("[LiveVideo]", e?.message || e);
      }
    })();

    return () => { cancelled = true; try { room?.disconnect(); } catch {} };
  }, [roomName, publish, active]);

  return (
    <div className={className}>
      <video
        ref={videoRef}
        autoPlay playsInline
        muted={publish ? true : muted}
        onClick={() => !publish && setMuted((m) => !m)}
        className={`w-full h-full object-cover ${hasVideo ? "" : "hidden"}`}
      />
      {!hasVideo && (poster
        ? <img src={poster} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full bg-black" />)}

      {state === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/80 text-[11px] font-bold bg-black/40 px-3 py-1.5 rounded-full">Connexion au live…</span>
        </div>
      )}
      {/* Bouton son (spectateur, quand un flux est présent) */}
      {!publish && hasVideo && (
        <button onClick={() => setMuted((m) => !m)}
          className="absolute top-16 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white z-30">
          <i className={`fa-solid ${muted ? "fa-volume-xmark" : "fa-volume-high"} text-xs`} />
        </button>
      )}
    </div>
  );
}
