import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export default function AffiliateRedirect() {
  const { code }   = useParams();
  const navigate   = useNavigate();

  useEffect(() => {
    if (code) {
      try {
        const existing = localStorage.getItem('ofs_ref_code');
        const ts       = Number(localStorage.getItem('ofs_ref_ts') || 0);
        const expired  = Date.now() - ts > REF_TTL_MS;
        if (!existing || expired) {
          localStorage.setItem('ofs_ref_code', code.toUpperCase());
          localStorage.setItem('ofs_ref_ts',   Date.now().toString());
        }
      } catch {}
    }
    navigate('/store', { replace: true });
  }, [code]);

  return null;
}
