import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { cjGetProductComments } from "../lib/cjApi";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return `Il y a ${Math.floor(days / 365)} an${days >= 730 ? "s" : ""}`;
};

// ─── STARS ────────────────────────────────────────────────────────────────────

const Stars = ({ value, size = "sm" }) => {
  const sz = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-[11px]";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={`fa-solid fa-star ${sz} ${i <= value ? "text-[#FF9900]" : "text-[#D5D9D9]"}`} />
      ))}
    </div>
  );
};

const StarInput = ({ value, onChange }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl transition-transform hover:scale-125 active:scale-95">
          <i className={`fa-solid fa-star transition-colors ${i <= (hovered || value) ? "text-[#FF9900]" : "text-[#D5D9D9]"}`} />
        </button>
      ))}
    </div>
  );
};

// ─── LIGHTBOX ─────────────────────────────────────────────────────────────────

const Lightbox = ({ photos, startIdx, onClose }) => {
  const [idx, setIdx] = useState(startIdx);
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(photos.length - 1, i + 1));
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [photos.length, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl z-10">
        <i className="fa-solid fa-xmark" />
      </button>
      {idx > 0 && (
        <button onClick={(e) => { e.stopPropagation(); setIdx((i) => i - 1); }}
          className="absolute left-4 text-white/60 hover:text-white text-3xl p-2">
          <i className="fa-solid fa-chevron-left" />
        </button>
      )}
      <img src={photos[idx]} alt="" className="max-h-[88vh] max-w-[88vw] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      {idx < photos.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); setIdx((i) => i + 1); }}
          className="absolute right-4 text-white/60 hover:text-white text-3xl p-2">
          <i className="fa-solid fa-chevron-right" />
        </button>
      )}
      {photos.length > 1 && (
        <div className="absolute bottom-5 flex gap-1.5">
          {photos.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── PHOTO STRIP ─────────────────────────────────────────────────────────────

const PhotoStrip = ({ photos }) => {
  const [lb, setLb] = useState(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {photos.map((url, i) => (
          <button key={i} onClick={() => setLb(i)}
            className="flex-shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden border border-[#D5D9D9] hover:border-[#FF9900] transition-all">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {lb !== null && <Lightbox photos={photos} startIdx={lb} onClose={() => setLb(null)} />}
    </>
  );
};

// ─── RATING SUMMARY ───────────────────────────────────────────────────────────

const RatingSummary = ({ reviews, allPhotos, filterStar, onFilterStar }) => {
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + Number(r._rating), 0) / reviews.length;
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Number(r._rating) === star).length,
    pct: (reviews.filter((r) => Number(r._rating) === star).length / reviews.length) * 100,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-6 bg-[#FAFAFA] border border-[#D5D9D9] rounded-xl p-5">
        {/* Score global */}
        <div className="text-center flex-shrink-0">
          <p className="text-5xl font-black text-[#0F1111] leading-none">{avg.toFixed(1)}</p>
          <Stars value={Math.round(avg)} size="md" />
          <p className="text-[9px] font-bold text-[#565959] mt-1.5">{reviews.length} avis</p>
        </div>
        {/* Barres */}
        <div className="flex-1 space-y-1.5">
          {counts.map(({ star, count, pct }) => (
            <button key={star} onClick={() => onFilterStar(filterStar === star ? null : star)}
              className={`w-full flex items-center gap-2 rounded px-1.5 py-0.5 transition-all ${filterStar === star ? "bg-[#FFF8D3]" : "hover:bg-[#F3F4F4]"}`}>
              <span className="text-[9px] font-black text-[#007185] w-3 text-right">{star}</span>
              <i className="fa-solid fa-star text-[#FF9900] text-[8px]" />
              <div className="flex-1 bg-[#E3E6E6] rounded-full h-2">
                <div className="h-2 rounded-full bg-[#FF9900] transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[9px] font-black text-[#565959] w-5 text-right">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Photo strip */}
      {allPhotos.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-[#565959] mb-2">
            <i className="fa-solid fa-images text-[#FF9900] mr-1.5" />
            Photos clients ({allPhotos.length})
          </p>
          <PhotoStrip photos={allPhotos} />
        </div>
      )}
    </div>
  );
};

// ─── REVIEW CARD ─────────────────────────────────────────────────────────────

const ReviewCard = ({ review, currentUserId, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  const [lb, setLb] = useState(null);
  const photos = review._photos || [];

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(review.id);
    setDeleting(false);
  };

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#F3F4F4] rounded-full flex items-center justify-center border border-[#D5D9D9] flex-shrink-0">
            <span className="font-black text-[#565959] text-xs">{(review._name?.[0] || "?").toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-[#0F1111]">{review._name}</span>
              {review._source === "cj" ? (
                <span className="flex items-center gap-1 text-[7px] font-black text-[#007185] bg-[#E6F3F5] border border-[#007185]/20 px-1.5 py-0.5 rounded-full">
                  <i className="fa-solid fa-globe text-[7px]" /> Acheteur CJ
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[7px] font-black text-[#007600] bg-[#E8F5E8] border border-[#007600]/20 px-1.5 py-0.5 rounded-full">
                  <i className="fa-solid fa-check text-[7px]" /> Vérifié OFS
                </span>
              )}
              {review._source === "cj" && review.flagIconUrl && (
                <img src={review.flagIconUrl} alt={review.countryCode} className="w-4 h-3 object-cover rounded-sm border border-[#D5D9D9]" />
              )}
            </div>
            <p className="text-[8px] text-[#767676] mt-0.5">{timeAgo(review._date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Stars value={review._rating} />
          {review._source === "ofs" && currentUserId === review.user_id && (
            <button onClick={handleDelete} disabled={deleting}
              className="w-6 h-6 flex items-center justify-center rounded text-[#D5D9D9] hover:text-[#B12704] hover:bg-[#FEE7E5] transition-all">
              {deleting
                ? <i className="fa-solid fa-circle-notch animate-spin text-[9px]" />
                : <i className="fa-solid fa-trash text-[9px]" />}
            </button>
          )}
        </div>
      </div>

      {/* Text */}
      {review._text && (
        <p className="text-[11px] text-[#0F1111] leading-relaxed">{review._text}</p>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((url, i) => (
            <button key={i} onClick={() => setLb(i)}
              className="w-[68px] h-[68px] rounded-lg overflow-hidden border border-[#D5D9D9] hover:border-[#FF9900] transition-all flex-shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {lb !== null && <Lightbox photos={photos} startIdx={lb} onClose={() => setLb(null)} />}
    </div>
  );
};

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────

const ImageUpload = ({ files, onChange, max = 4 }) => {
  const inputRef = useRef(null);

  const handleSelect = (e) => {
    const picked = Array.from(e.target.files);
    onChange([...files, ...picked].slice(0, max));
    e.target.value = "";
  };

  const remove = (i) => onChange(files.filter((_, j) => j !== i));

  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-wider text-[#565959] mb-2">
        Photos (optionnel · max {max})
      </p>
      <div className="flex gap-2 flex-wrap">
        {files.map((f, i) => (
          <div key={i} className="relative w-[68px] h-[68px] rounded-lg overflow-hidden border border-[#D5D9D9] group">
            <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => remove(i)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
              <i className="fa-solid fa-xmark text-white text-sm" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-[68px] h-[68px] rounded-lg border-2 border-dashed border-[#D5D9D9] hover:border-[#FF9900] flex flex-col items-center justify-center gap-1 transition-all text-[#ADBAC7] hover:text-[#FF9900]">
            <i className="fa-solid fa-camera text-lg" />
            <span className="text-[7px] font-black">Ajouter</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSelect} />
    </div>
  );
};

// ─── REVIEW FORM ─────────────────────────────────────────────────────────────

const ReviewForm = ({ productId, userId, userName, onSubmitted, onCancel }) => {
  const [rating, setRating]       = useState(0);
  const [text, setText]           = useState("");
  const [files, setFiles]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const uploadImages = async () => {
    const urls = [];
    for (const file of files) {
      const ext  = file.name.split(".").pop();
      const path = `${productId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("review-images").upload(path, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("review-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return setError("Choisissez une note.");
    if (text.trim().length < 10) return setError("L'avis doit faire au moins 10 caractères.");
    setLoading(true);
    setError("");
    try {
      const images = await uploadImages();
      const { error: err } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id:    userId,
        user_name:  userName,
        rating,
        text:       text.trim(),
        images,
        approved:   true,
      });
      if (err) {
        if (err.code === "23505") setError("Vous avez déjà laissé un avis sur ce produit.");
        else setError("Erreur publication. Réessayez.");
        return;
      }
      setRating(0); setText(""); setFiles([]);
      onSubmitted();
    } catch {
      setError("Erreur lors de l'upload des photos. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#FAFAFA] border border-[#D5D9D9] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#565959]">
          <i className="fa-solid fa-pen mr-1.5 text-[#FF9900]" />
          Écrire un avis
        </h4>
        <button type="button" onClick={onCancel} className="text-[#ADBAC7] hover:text-[#565959] transition-colors">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-[#565959] mb-2">Note *</p>
          <StarInput value={rating} onChange={setRating} />
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-[#565959] mb-2">Votre avis *</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            maxLength={500} rows={4}
            placeholder="Qualité, livraison, satisfaction globale..."
            className="w-full bg-white border border-[#D5D9D9] rounded-lg px-4 py-3 text-xs text-[#0F1111] placeholder-[#ADBAC7] outline-none focus:border-[#FF9900] transition-colors resize-none"
          />
          <p className="text-[8px] text-[#ADBAC7] text-right mt-0.5">{text.length}/500</p>
        </div>
        <ImageUpload files={files} onChange={setFiles} />
        {error && (
          <div className="bg-[#FEE7E5] border border-[#B12704]/20 rounded-lg px-4 py-3">
            <p className="text-[#B12704] text-[9px] font-black uppercase">{error}</p>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] font-black uppercase text-[10px] tracking-widest rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading
            ? <><i className="fa-solid fa-circle-notch animate-spin text-xs" /> Publication...</>
            : <><i className="fa-solid fa-star text-xs" /> Publier mon avis</>}
        </button>
      </form>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════

const ReviewsSection = ({ productId, cjProductId }) => {
  const { user, isMember, isVendor } = useAuth();
  const [ofsReviews, setOfsReviews]   = useState([]);
  const [cjReviews,  setCjReviews]    = useState([]);
  const [loading,    setLoading]      = useState(true);
  const [cjLoading,  setCjLoading]    = useState(false);
  const [error,      setError]        = useState("");
  const [sortBy,     setSortBy]       = useState("recent");
  const [filterStar, setFilterStar]   = useState(null);
  const [source,     setSource]       = useState("all");
  const [showForm,   setShowForm]     = useState(false);
  const [hasReviewed,setHasReviewed]  = useState(false);
  const [visible,    setVisible]      = useState(5);

  const userName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Utilisateur";

  const fetchOfs = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("approved", true)
      .order("created_at", { ascending: false });
    if (!err) {
      setOfsReviews(data || []);
      if (user) setHasReviewed(data?.some((r) => r.user_id === user.id) ?? false);
    } else {
      setError("Impossible de charger les avis.");
    }
    setLoading(false);
  }, [productId, user]);

  const fetchCj = useCallback(async () => {
    if (!cjProductId) { console.log("[Reviews] pas de cjProductId"); return; }
    setCjLoading(true);
    try {
      const data = await cjGetProductComments(cjProductId, { pageSize: 50 });
      console.log("[Reviews CJ]", cjProductId, data);
      setCjReviews(data?.list || []);
    } catch (e) {
      console.warn("[Reviews CJ error]", e.message);
    }
    setCjLoading(false);
  }, [cjProductId]);

  useEffect(() => { fetchOfs(); fetchCj(); }, [fetchOfs, fetchCj]);

  const handleDelete = async (id) => {
    await supabase.from("reviews").delete().eq("id", id);
    fetchOfs();
  };

  // Normalize to unified shape with _rating, _name, _text, _date, _photos, _source
  const allReviews = [
    ...ofsReviews.map((r) => ({
      ...r,
      _source: "ofs",
      _rating: Number(r.rating),
      _name:   r.user_name,
      _text:   r.text,
      _date:   r.created_at,
      _photos: r.images || [],
    })),
    ...cjReviews.map((r) => ({
      ...r,
      _source: "cj",
      _rating: Number(r.score),
      _name:   r.commentUser,
      _text:   r.comment,
      _date:   r.commentDate,
      _photos: r.commentUrls || [],
    })),
  ];

  const allPhotos = allReviews.flatMap((r) => r._photos);

  const displayed = allReviews
    .filter((r) => source === "all" || r._source === source)
    .filter((r) => filterStar === null || r._rating === filterStar)
    .sort((a, b) => {
      if (sortBy === "best")  return b._rating - a._rating;
      if (sortBy === "worst") return a._rating - b._rating;
      return new Date(b._date) - new Date(a._date);
    });

  const hasCj  = cjReviews.length > 0;
  const hasOfs = ofsReviews.length > 0;

  return (
    <div className="space-y-5">
      {/* SUMMARY */}
      {loading ? (
        <div className="animate-pulse h-32 bg-[#F3F4F4] rounded-xl" />
      ) : allReviews.length > 0 ? (
        <RatingSummary
          reviews={allReviews}
          allPhotos={allPhotos}
          filterStar={filterStar}
          onFilterStar={setFilterStar}
        />
      ) : (
        <div className="bg-white border border-dashed border-[#D5D9D9] rounded-xl p-10 text-center">
          <i className="fa-regular fa-star text-3xl text-[#D5D9D9] mb-3 block" />
          <p className="font-black text-[#565959] text-sm">Aucun avis pour l'instant</p>
          <p className="text-[9px] text-[#ADBAC7] mt-1 uppercase">Soyez le premier à donner votre avis</p>
        </div>
      )}

      {/* SOURCE TABS */}
      {hasOfs && hasCj && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "all", label: `Tous (${allReviews.length})` },
            { key: "ofs", label: `OFS (${ofsReviews.length})` },
            { key: "cj",  label: `Acheteurs CJ (${cjReviews.length})` },
          ].map((opt) => (
            <button key={opt.key} onClick={() => setSource(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                source === opt.key
                  ? "bg-[#131921] text-[#FF9900] border-[#131921]"
                  : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#565959]"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* CTA ÉTATS */}
      {!user && (
        <div className="bg-[#E6F3F5] border border-[#007185]/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase text-[#007185] tracking-widest">Laissez un avis avec photos</p>
            <p className="text-[9px] text-[#565959] mt-0.5">Connectez-vous pour partager votre expérience</p>
          </div>
          <a href="/login"
            className="flex-shrink-0 bg-[#FF9900] hover:bg-[#E47911] text-[#0F1111] px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all">
            Se connecter
          </a>
        </div>
      )}

      {user && isVendor && (
        <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded-xl p-4">
          <p className="text-[10px] font-black uppercase text-[#565959] tracking-widest">
            <i className="fa-solid fa-store text-[#FF9900] mr-2" />
            Les vendeurs ne peuvent pas laisser d'avis
          </p>
        </div>
      )}

      {user && isMember && hasReviewed && (
        <div className="bg-[#E8F5E8] border border-[#007600]/20 rounded-xl p-4 flex items-center gap-3">
          <i className="fa-solid fa-circle-check text-[#007600]" />
          <p className="text-[10px] font-black uppercase text-[#007600] tracking-widest">Vous avez déjà laissé un avis · Merci !</p>
        </div>
      )}

      {user && isMember && !hasReviewed && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full py-3 bg-white border border-dashed border-[#FF9900]/50 hover:border-[#FF9900] text-[#FF9900] font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-[#FFF8D3] transition-all flex items-center justify-center gap-2">
          <i className="fa-solid fa-camera text-xs" />
          Écrire un avis avec photos
        </button>
      )}

      {user && isMember && !hasReviewed && showForm && (
        <ReviewForm
          productId={productId}
          userId={user.id}
          userName={userName}
          onSubmitted={() => { setShowForm(false); fetchOfs(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* REVIEWS LIST */}
      {displayed.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black uppercase text-[#565959] tracking-widest">Trier :</span>
              {[
                { key: "recent", label: "Récents"  },
                { key: "best",   label: "Meilleurs" },
                { key: "worst",  label: "Critiques" },
              ].map((opt) => (
                <button key={opt.key} onClick={() => setSortBy(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                    sortBy === opt.key
                      ? "bg-[#131921] text-white border-[#131921]"
                      : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#565959]"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {filterStar && (
              <button onClick={() => setFilterStar(null)}
                className="flex items-center gap-1.5 text-[9px] font-black text-[#B12704] bg-[#FEE7E5] border border-[#B12704]/20 px-2.5 py-1.5 rounded-lg">
                <i className="fa-solid fa-xmark text-[8px]" />
                Filtrer : {filterStar}★
              </button>
            )}
          </div>

          {cjLoading || loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-24 bg-[#F3F4F4] rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.slice(0, visible).map((rev, i) => (
                <ReviewCard
                  key={rev.commentId || rev.id || i}
                  review={rev}
                  currentUserId={user?.id}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {displayed.length > visible && (
            <button onClick={() => setVisible((v) => v + 10)}
              className="w-full py-3 bg-white border border-[#D5D9D9] hover:border-[#565959] text-[#565959] font-bold text-sm rounded-xl transition-all">
              Voir {Math.min(10, displayed.length - visible)} avis de plus ({displayed.length - visible} restants)
            </button>
          )}
        </>
      )}

      {error && (
        <div className="bg-[#FEE7E5] border border-[#B12704]/20 rounded-xl p-4">
          <p className="text-[#B12704] text-[9px] font-black uppercase">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;
