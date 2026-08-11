-- ════════════════════════════════════════════════════════════════════════════
-- NUMÉROS MOBILE MONEY DU VENDEUR
--   momo_orange_number : numéro Orange Money sur lequel le vendeur encaisse
--   momo_mtn_number    : numéro MTN MoMo sur lequel le vendeur encaisse
--   description        : présentation de la boutique, éditable depuis le
--                        dashboard (la colonne existait pour les demandes
--                        vendeur mais pas forcément sur `vendors`)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS momo_orange_number TEXT,
  ADD COLUMN IF NOT EXISTS momo_mtn_number    TEXT,
  ADD COLUMN IF NOT EXISTS description        TEXT;

-- Format attendu : chiffres uniquement, indicatif pays compris (ex : 237691234567).
-- Le formulaire normalise avant l'envoi ; la contrainte empêche les saisies
-- fantaisistes d'atteindre la base.
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_momo_orange_format;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_momo_orange_format
  CHECK (momo_orange_number IS NULL OR momo_orange_number ~ '^[0-9]{8,15}$');

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_momo_mtn_format;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_momo_mtn_format
  CHECK (momo_mtn_number IS NULL OR momo_mtn_number ~ '^[0-9]{8,15}$');

-- Le nom de boutique sert d'adresse publique (/shop/<nom>) : deux boutiques ne
-- peuvent pas porter le même nom, à la casse et aux espaces près.
-- Si des doublons existent déjà, on ne bloque pas la migration : on prévient,
-- et l'index pourra être créé après nettoyage. Le dashboard vérifie de toute
-- façon la disponibilité du nom avant d'enregistrer.
DO $$
DECLARE dupes INT;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT lower(btrim(shop_name)) AS n
    FROM public.vendors
    WHERE shop_name IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE WARNING 'vendors : % nom(s) de boutique en double — index unique non créé. Renommez-les puis rejouez ce bloc.', dupes;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS vendors_shop_name_unique_ci
      ON public.vendors (lower(btrim(shop_name)));
  END IF;
END $$;
