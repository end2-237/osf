// ─── Translation lib — MyMemory API + localStorage cache ─────────────────────
// Free tier: 1000 words/day without key. We cache aggressively so real-world
// usage stays well below that. Cache TTL: 7 days.

const MEM   = new Map();            // in-memory for current session
const LS_KEY = "ofs_tc";
const TTL    = 7 * 24 * 3600_000;
const INFLIGHT = new Map();         // dedup concurrent requests for same key

function _loadDisk() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const { ts, d } = JSON.parse(raw);
    if (Date.now() - ts > TTL) { localStorage.removeItem(LS_KEY); return; }
    Object.entries(d).forEach(([k, v]) => MEM.set(k, v));
  } catch {}
}
function _saveDisk() {
  try {
    const d = {};
    MEM.forEach((v, k) => { d[k] = v; });
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), d }));
  } catch {}
}
_loadDisk();

// Strip HTML tags for plain-text translation
export const stripHtml = (html = "") =>
  html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

export async function translateText(text, from = "en", to = "fr") {
  if (!text || !text.trim() || from === to) return text;
  // Truncate (MyMemory limit: 500 chars per request)
  const t   = text.slice(0, 500);
  const key = `${from}>${to}:${t}`;

  if (MEM.has(key)) return MEM.get(key);
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);

  const req = (async () => {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=${from}|${to}`;
      const r   = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const tr = j?.responseData?.translatedText || "";
      // Reject nonsense responses from MyMemory
      const ok = tr && tr.length > 0
        && !tr.toUpperCase().includes("LIMIT EXCEDEED")
        && !tr.toUpperCase().includes("QUERY LENGTH");
      const result = ok ? tr : text;
      MEM.set(key, result);
      _saveDisk();
      return result;
    } catch {
      return text;                  // fallback: original text
    } finally {
      INFLIGHT.delete(key);
    }
  })();

  INFLIGHT.set(key, req);
  return req;
}

export function clearTranslateCache() {
  MEM.clear();
  try { localStorage.removeItem(LS_KEY); } catch {}
}
