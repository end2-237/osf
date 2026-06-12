import { useEffect } from 'react';

const SCRIPT_ID = 'ofs-jsonld';

export const useJsonLd = (schema) => {
  useEffect(() => {
    if (!schema) return;
    let el = document.getElementById(SCRIPT_ID);
    if (!el) {
      el = document.createElement('script');
      el.id = SCRIPT_ID;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(Array.isArray(schema) ? schema : [schema]);
    return () => {
      const s = document.getElementById(SCRIPT_ID);
      if (s) s.remove();
    };
  }, [JSON.stringify(schema)]);
};
