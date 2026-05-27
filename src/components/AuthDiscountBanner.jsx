import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MEMBER_DISCOUNT_RATE } from '../utils/discountUtils';

export default function AuthDiscountBanner({ variant = 'full' }) {
  const { user } = useAuth();
  if (user) return null;

  const pct = Math.round(MEMBER_DISCOUNT_RATE * 100);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 bg-[#FFF8D3] border border-[#FCD200] rounded px-3 py-2 text-sm">
        <i className="fa-solid fa-tag text-[#FF9900] text-xs flex-shrink-0"></i>
        <span className="text-[#0F1111] text-xs font-bold">
          -{pct}% membre disponible —{' '}
        </span>
        <Link to="/register" className="text-[#007185] text-xs font-bold hover:underline whitespace-nowrap">
          Créer un compte gratuit →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#131921] rounded p-5 border border-[#232F3E]">
      <div className="absolute top-0 right-0 w-40 h-full opacity-5 pointer-events-none">
        <i className="fa-solid fa-crown text-[#FF9900]" style={{ fontSize: 120 }}></i>
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#FF9900]/15 border border-[#FF9900]/30 text-[#FF9900] text-[9px] font-black uppercase tracking-widest rounded-full px-3 py-1">
              Offre Membre Elite
            </span>
          </div>
          <h3 className="text-lg font-black text-white leading-tight mb-1">
            Économisez <span className="text-[#FF9900]">-{pct}%</span> sur tous les produits
          </h3>
          <p className="text-[#ADBAC7] text-sm leading-relaxed">
            Créez un compte gratuit et déverrouillez vos prix exclusifs instantanément.
          </p>
        </div>

        <div className="flex gap-3 shrink-0 flex-wrap">
          <Link
            to="/register"
            className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] font-black px-5 py-2.5 rounded text-sm border border-[#FCD200] transition-colors whitespace-nowrap"
          >
            Créer un compte
          </Link>
          <Link
            to="/login"
            className="border border-[#D5D9D9]/30 text-[#D5D9D9] hover:border-[#FF9900] hover:text-[#FF9900] font-bold px-4 py-2.5 rounded text-sm transition-colors whitespace-nowrap"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
