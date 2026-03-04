import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ── STAR DISPLAY ── */
const StarDisplay = ({ rating, size = "sm" }) => {
  const sz = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-[10px]";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={`fa-solid fa-star ${sz} ${i <= rating ? "text-yellow-400" : "text-zinc-200"}`} />
      ))}
    </div>
  );
};

/* ── STAR INPUT ── */
const StarInput = ({ value, onChange }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="text-xl transition-all hover:scale-125 active:scale-95"
        >
          <i className={`fa-solid fa-star transition-colors ${i <= (hovered || value) ? "text-yellow-400" : "text-zinc-200"}`} />
        </button>
      ))}
    </div>
  );
};

/* ── RATING BREAKDOWN ── */
const RatingBreakdown = ({ reviews }) => {
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: (reviews.filter((r) => r.rating === star).length / reviews.length) * 100,
  }));

  return (
    <div className="flex items-center gap-6 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
      <div className="text-center flex-shrink-0">
        <p className="text-5xl font-black italic text-primary leading-none">{avg.toFixed(1)}</p>
        <StarDisplay rating={Math.round(avg)} size="md" />
        <p className="text-[9px] font-black uppercase text-zinc-400 mt-1">{reviews.length} avis</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {counts.map(({ star, count, pct }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-[9px] font-black text-zinc-400 w-2">{star}</span>
            <i className="fa-solid fa-star text-yellow-400 text-[8px]" />
            <div className="flex-1 bg-zinc-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[9px] font-black text-zinc-400 w-5 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── REVIEW CARD ── */
const ReviewCard = ({ review, currentUserId, onDelete }) => {
  const [deleting, setDeleting] = useState(false);

  const timeAgo = (dateStr) => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 7) return `Il y a ${days} jours`;
    if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${days >= 14 ? "s" : ""}`;
    return `Il y a ${Math.floor(days / 30)} mois`;
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(review.id);
    setDeleting(false);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 flex-shrink-0">
            <span className="font-black text-primary text-xs">{review.user_name?.[0]?.toUpperCase() || "?"}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-black uppercase text-zinc-900">{review.user_name}</p>
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full">
                ✓ Vérifié
              </span>
            </div>
            <p className="text-[8px] font-bold text-zinc-400">{timeAgo(review.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarDisplay rating={review.rating} />
          {currentUserId === review.user_id && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
            >
              {deleting
                ? <i className="fa-solid fa-circle-notch animate-spin text-[9px]" />
                : <i className="fa-solid fa-trash text-[9px]" />
              }
            </button>
          )}
        </div>
      </div>
      <p className="text-zinc-500 text-xs font-bold leading-relaxed">{review.text}</p>
    </div>
  );
};

/* ── REVIEW FORM ── */
const ReviewForm = ({ productId, userId, userName, onSubmitted, onCancel }) => {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return setError("Choisissez une note.");
    if (text.trim().length < 10) return setError("Votre avis doit faire au moins 10 caractères.");

    setLoading(true);
    setError("");

    const { error: err } = await supabase.from("reviews").insert({
      product_id: productId,
      user_id: userId,
      user_name: userName,
      rating,
      text: text.trim(),
    });

    setLoading(false);

    if (err) {
      if (err.code === "23505") setError("Vous avez déjà laissé un avis sur ce produit.");
      else setError("Erreur lors de la publication. Réessayez.");
      return;
    }

    setRating(0);
    setText("");
    onSubmitted();
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Laisser un avis
        </h4>
        <button onClick={onCancel} className="text-zinc-300 hover:text-zinc-500 transition-colors">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Note *</p>
          <StarInput value={rating} onChange={setRating} />
        </div>

        <div>
          <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Votre avis *</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Partagez votre expérience avec ce produit..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 placeholder-zinc-300 outline-none focus:border-primary transition-colors resize-none"
          />
          <p className="text-[8px] font-bold text-zinc-300 text-right mt-1">{text.length}/500</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-500 text-[9px] font-black uppercase">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_6px_20px_rgba(0,255,136,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading
            ? <><i className="fa-solid fa-circle-notch animate-spin text-xs" /> Publication...</>
            : <><i className="fa-solid fa-star text-xs" /> Publier mon avis</>
          }
        </button>
      </form>
    </div>
  );
};

/* ══════════════════════════════════════
    MAIN REVIEWS SECTION
══════════════════════════════════════ */
const SORT_OPTS = [
  { key: "recent", label: "Récents" },
  { key: "best", label: "Meilleurs" },
  { key: "worst", label: "Critiques" },
];

const ReviewsSection = ({ productId }) => {
  const { user, isMember, isVendor } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const userName =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Utilisateur";

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (err) {
      setError("Impossible de charger les avis.");
    } else {
      setReviews(data || []);
      if (user) setHasReviewed(data?.some((r) => r.user_id === user.id) ?? false);
    }
    setLoading(false);
  }, [productId, user]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleDelete = async (reviewId) => {
    const { error: err } = await supabase.from("reviews").delete().eq("id", reviewId);
    if (!err) fetchReviews();
  };

  const sorted = [...reviews].sort((a, b) => {
    if (sortBy === "best") return b.rating - a.rating;
    if (sortBy === "worst") return a.rating - b.rating;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="max-w-2xl space-y-6">
      {/* BREAKDOWN */}
      {loading ? (
        <div className="animate-pulse h-28 bg-zinc-100 rounded-2xl" />
      ) : reviews.length > 0 ? (
        <RatingBreakdown reviews={reviews} />
      ) : (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center">
          <i className="fa-regular fa-star text-3xl text-zinc-200 mb-3 block" />
          <p className="font-black uppercase italic text-zinc-400 text-sm">Aucun avis pour l'instant</p>
          <p className="text-[9px] font-bold text-zinc-300 mt-1 uppercase">Soyez le premier à donner votre avis</p>
        </div>
      )}

      {/* ── AUTH STATES ── */}
      {!user && (
        <div className="bg-gradient-to-r from-primary/8 to-transparent border border-primary/20 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase text-primary tracking-widest">
              Connectez-vous pour laisser un avis
            </p>
            <p className="text-[9px] font-bold text-zinc-400 mt-0.5">Partagez votre expérience</p>
          </div>
          <a
            href="/login"
            className="flex-shrink-0 bg-primary text-black px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 transition-all"
          >
            Se connecter
          </a>
        </div>
      )}

      {user && isVendor && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
            <i className="fa-solid fa-store text-primary mr-2" />
            Les vendeurs ne peuvent pas laisser d'avis
          </p>
        </div>
      )}

      {user && isMember && hasReviewed && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
          <i className="fa-solid fa-check-circle text-primary text-sm" />
          <p className="text-[10px] font-black uppercase text-primary tracking-widest">
            Vous avez déjà laissé un avis · Merci !
          </p>
        </div>
      )}

      {user && isMember && !hasReviewed && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 bg-white border-2 border-dashed border-primary/30 hover:border-primary text-primary font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-pen text-xs" />
          Écrire un avis
        </button>
      )}

      {user && isMember && !hasReviewed && showForm && (
        <ReviewForm
          productId={productId}
          userId={user.id}
          userName={userName}
          onSubmitted={() => { setShowForm(false); fetchReviews(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-500 text-[9px] font-black uppercase">{error}</p>
        </div>
      )}

      {/* REVIEWS LIST */}
      {reviews.length > 0 && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Trier :</span>
            {SORT_OPTS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                  sortBy === opt.key
                    ? "bg-zinc-900 text-primary border-zinc-900"
                    : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-24 bg-zinc-100 rounded-2xl" />
                ))
              : sorted.map((rev) => (
                  <ReviewCard
                    key={rev.id}
                    review={rev}
                    currentUserId={user?.id}
                    onDelete={handleDelete}
                  />
                ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ReviewsSection;