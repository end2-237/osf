// ────────────────────────────────────────────────────────────────────────────
// LiveKit — récupération d'un jeton d'accès WebRTC via l'Edge Function.
// Activé uniquement si VITE_LIVEKIT_URL est défini ; sinon les composants
// vidéo retombent proprement sur l'image de couverture.
// ────────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabase";

export const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "";
// On tente toujours LiveKit : l'Edge Function `livekit-token` est la source de
// vérité (elle détient les secrets ET renvoie l'URL). Si elle n'est pas
// configurée, l'appel échoue et les composants retombent sur l'image.
// → plus besoin de variable VITE_ au build du front.
export const LIVEKIT_ENABLED = true;

export async function getLiveToken(room, publish = false) {
  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: { room, publish },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { token: data.token, url: data.url || LIVEKIT_URL };
}
