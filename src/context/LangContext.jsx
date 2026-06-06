import React, { createContext, useContext, useState } from "react";

// Default: "en" (CJ products are in English). Toggle to "fr" = auto-translate.
const LangContext = createContext({ lang: "en", toggleLang: () => {} });

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("ofs_lang") || "en"; } catch { return "en"; }
  });

  const toggleLang = () => {
    const next = lang === "fr" ? "en" : "fr";
    setLang(next);
    try { localStorage.setItem("ofs_lang", next); } catch {}
  };

  return (
    <LangContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
