import { useState, useEffect, useRef } from "react";
import { useLang } from "../context/LangContext";
import { translateText } from "../lib/translate";

/**
 * Returns translated text. Shows original immediately, swaps when translation
 * arrives. If lang === sourceLang the original is returned as-is (no fetch).
 */
export function useTranslate(text, sourceLang = "en") {
  const { lang }      = useLang();
  const [out, setOut] = useState(text);
  const alive         = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!text || lang === sourceLang) { setOut(text); return; }
    setOut(text);                          // show original while loading
    translateText(text, sourceLang, lang).then(t => {
      if (alive.current) setOut(t);
    });
    return () => { alive.current = false; };
  }, [text, sourceLang, lang]);

  return out;
}
