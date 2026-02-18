import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getMemberPrice,
  getSavings,
  formatPrice,
  MEMBER_DISCOUNT_RATE,
} from '../utils/discountUtils';

/**
 * MemberPriceDisplay
 *
 * Shows the correct price depending on auth state:
 *  - Non-authenticated  → original price + "lock" hint showing member price
 *  - Member (no vendor) → member price (25% off) + strike-through original
 *  - Vendor             → original price (no discount applies)
 *
 * Props:
 *   originalPrice  {number}   raw price from the database
 *   size           'sm'|'md'|'lg'  – controls text sizing (default 'md')
 *   showSavings    {boolean}  show savings chip (default true)
 *   className      {string}   extra wrapper classes
 */
export default function MemberPriceDisplay({
  originalPrice,
  size = 'md',
  showSavings = true,
  className = '',
}) {
  const { user, isMember, isVendor } = useAuth();
  const discountPct = Math.round(MEMBER_DISCOUNT_RATE * 100);

  const sizeMap = {
    sm: { main: 'text-base', strike: 'text-xs', badge: 'text-xs px-2 py-0.5' },
    md: { main: 'text-xl',   strike: 'text-sm', badge: 'text-xs px-2 py-0.5' },
    lg: { main: 'text-3xl',  strike: 'text-base', badge: 'text-sm px-3 py-1' },
  };
  const s = sizeMap[size] ?? sizeMap.md;

  // ── Case 1: Authenticated member → show discounted price ──────────────
  if (isMember) {
    const memberPrice = getMemberPrice(originalPrice, true, false);
    const savings     = getSavings(originalPrice, true, false);

    return (
      <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
        {/* Discounted price */}
        <span className={`${s.main} font-extrabold text-emerald-600`}>
          {formatPrice(memberPrice)}
        </span>

        {/* Original strike-through */}
        <span className={`${s.strike} line-through text-gray-400`}>
          {formatPrice(originalPrice)}
        </span>

        {/* Savings chip */}
        {showSavings && savings > 0 && (
          <span className={`${s.badge} bg-emerald-100 text-emerald-700 font-bold rounded-full`}>
            −{discountPct}% membre
          </span>
        )}
      </div>
    );
  }

  // ── Case 2: Vendor OR non-authenticated → show original price ─────────
  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      {/* Original price */}
      <span className={`${s.main} font-extrabold text-gray-900`}>
        {formatPrice(originalPrice)}
      </span>

      {/* Hint for anonymous users: show what they could pay */}
      {!user && (
        <span className={`${s.badge} inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-medium`}>
          🔒{' '}
          <Link to="/register" className="hover:underline">
            Prix membre : {formatPrice(getMemberPrice(originalPrice, true, false))}
          </Link>
        </span>
      )}
    </div>
  );
}

/**
 * MemberLockButton
 *
 * Small CTA block shown on product cards to non-authenticated users.
 * Encourages sign-up by showing the exact savings possible.
 */
export function MemberLockButton({ originalPrice, className = '' }) {
  const { user } = useAuth();
  if (user) return null;

  const savings = getSavings(originalPrice, true, false);
  if (savings <= 0) return null;

  return (
    <Link
      to="/register"
      className={`flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl px-3 py-2 text-xs font-semibold shadow-sm hover:shadow-md transition-all ${className}`}
    >
      <span>🏷️</span>
      <span>
        Économisez <strong>{formatPrice(savings)}</strong> en rejoignant le club
      </span>
      <span className="ml-auto">→</span>
    </Link>
  );
}