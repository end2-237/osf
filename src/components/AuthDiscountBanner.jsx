import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MEMBER_DISCOUNT_RATE } from '../utils/discountUtils';

/**
 * AuthDiscountBanner
 *
 * Shows a conversion banner to non-authenticated users highlighting
 * the member discount they're missing out on.
 * Renders nothing for authenticated users.
 *
 * Usage:
 *   <AuthDiscountBanner />                  — default full banner
 *   <AuthDiscountBanner variant="compact" /> — slim inline strip
 */
export default function AuthDiscountBanner({ variant = 'full' }) {
  const { user } = useAuth();

  // Already logged in — nothing to show
  if (user) return null;

  const discountPct = Math.round(MEMBER_DISCOUNT_RATE * 100);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
        <span className="text-amber-500 font-bold text-base">🏷️</span>
        <span className="text-amber-800">
          <strong>-{discountPct}%</strong> membre disponible —{' '}
        </span>
        <Link
          to="/register"
          className="text-amber-700 underline font-semibold hover:text-amber-900 whitespace-nowrap"
        >
          Créer un compte gratuit →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl p-5 text-white shadow-lg">
      {/* Background decoration */}
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: message */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-white/20 rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide">
              Offre membre
            </span>
          </div>
          <h3 className="text-xl font-bold">
            Économisez {discountPct}% sur tous les produits
          </h3>
          <p className="text-emerald-100 text-sm mt-1">
            Créez un compte gratuit et déverrouillez vos prix exclusifs instantanément.
            La navigation reste libre — l'inscription, c'est uniquement pour les avantages.
          </p>
        </div>

        {/* Right: CTA */}
        <div className="flex gap-3 shrink-0">
          <Link
            to="/register"
            className="bg-white text-emerald-700 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-emerald-50 transition-colors shadow-sm whitespace-nowrap"
          >
            Créer un compte
          </Link>
          <Link
            to="/login"
            className="border border-white/50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}