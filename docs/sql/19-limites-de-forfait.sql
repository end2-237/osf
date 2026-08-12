-- ════════════════════════════════════════════════════════════════════════════
--  LIMITES DE FORFAIT, EXPIRATION, ET CHOIX DE CE QUI RESTE EN VITRINE
--
--  Jusqu'ici un forfait payant n'apportait rien de vérifiable : rien ne
--  limitait le catalogue, et une échéance passée n'avait aucun effet.
--
--  Ce que ce fichier pose :
--
--  1. CHAQUE FORFAIT A SES LIMITES, portées par la table des forfaits — donc
--     ajustables sans déploiement. Le gratuit plafonne le catalogue et n'ouvre
--     ni la livraison Buyticle, ni les lives, ni la remise membre.
--
--  2. UNE ÉCHÉANCE PASSÉE FERME LA VITRINE. La boutique et ses produits
--     disparaissent des pages publiques jusqu'au renouvellement. Ils ne sont
--     pas supprimés — le vendeur les retrouve intacts en se réabonnant.
--
--  3. REDESCENDRE AU GRATUIT RESTE POSSIBLE, toujours. C'est la porte de
--     sortie : on ne prend personne en otage. Mais le catalogue repasse alors
--     sous le plafond du gratuit, et c'est LE VENDEUR qui choisit ce qui reste
--     en vitrine — pas un tri automatique qui masquerait ses meilleures ventes.
--
--  Idempotent : rejouable sans dommage, dans n'importe quel ordre.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('vendor_plan_state', 'vendor_is_live', 'set_product_listed',
                         'enforce_product_quota', 'my_catalog_quota',
                         'enforce_courier_quota', 'enforce_photo_quota')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. CE QU'UN FORFAIT AUTORISE
-- ════════════════════════════════════════════════════════════════════════════
-- `is_active` existe déjà en production ; on le pose par sécurité pour que ce
-- fichier tienne debout tout seul sur une base fraîche.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_products          INTEGER,   -- NULL = illimité
  ADD COLUMN IF NOT EXISTS max_couriers          INTEGER,
  ADD COLUMN IF NOT EXISTS max_photos_per_product INTEGER,
  ADD COLUMN IF NOT EXISTS allows_delivery       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allows_live           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allows_member_discount BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allows_stats          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allows_sponsored      BOOLEAN NOT NULL DEFAULT FALSE;

-- Les valeurs sont écrasées à chaque passage : c'est la grille de référence,
-- pas une préférence d'utilisateur.
UPDATE public.subscription_plans SET
  max_products = 20, max_couriers = 1, max_photos_per_product = 3,
  allows_delivery = FALSE, allows_live = FALSE, allows_member_discount = FALSE,
  allows_stats = FALSE, allows_sponsored = FALSE,
  features = '["Boutique en ligne","Jusqu''à 20 produits en vitrine","Paiement mobile money","Commandes illimitées","1 livreur"]'::JSONB
WHERE code = 'starter';

UPDATE public.subscription_plans SET
  max_products = 300, max_couriers = 5, max_photos_per_product = 8,
  allows_delivery = TRUE, allows_live = TRUE, allows_member_discount = TRUE,
  allows_stats = TRUE, allows_sponsored = FALSE,
  features = '["Jusqu''à 300 produits","Statistiques détaillées","Buyticle Delivery","Remise membre personnalisée","Lives de vente","5 livreurs","Support prioritaire"]'::JSONB
WHERE code = 'pro';

UPDATE public.subscription_plans SET
  max_products = NULL, max_couriers = NULL, max_photos_per_product = 12,
  allows_delivery = TRUE, allows_live = TRUE, allows_member_discount = TRUE,
  allows_stats = TRUE, allows_sponsored = TRUE,
  features = '["Produits illimités","Tout le Pro","Mise en avant sur l''accueil","Bannières sponsorisées","Livreurs illimités","Gestionnaire de compte","Rapports mensuels"]'::JSONB
WHERE code = 'elite';

-- ════════════════════════════════════════════════════════════════════════════
--  2. CE QUI RESTE EN VITRINE
--
--  Un produit déréférencé n'est pas supprimé : il dort. Le vendeur le
--  remettra en vitrine en reprenant un forfait, ou en libérant une place.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS products_listed_idx ON public.products(vendor_id)
  WHERE is_listed;

COMMENT ON COLUMN public.products.is_listed IS
  'Le vendeur choisit ce qui occupe ses places de vitrine quand son forfait '
  'en compte moins que son catalogue. Un produit non listé reste éditable.';

-- ════════════════════════════════════════════════════════════════════════════
--  3. L'ABONNEMENT EST-IL EN COURS ?
--
--  Le gratuit n'expire pas : c'est le socle. Un forfait payant sans échéance
--  est traité comme actif — mieux vaut laisser une boutique ouverte à tort
--  que fermer une vitrine à cause d'une donnée manquante.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vendor_is_live(p_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id
      AND COALESCE(v.is_active, TRUE)
      AND (
        COALESCE(v.plan, 'starter') = 'starter'
        OR v.plan_expires_at IS NULL
        OR v.plan_expires_at > NOW()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.vendor_is_live(UUID) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. LA VITRINE SE FERME À L'ÉCHÉANCE
--
--  On remplace la lecture publique « tout le monde voit tout » par une règle
--  qui tient compte du forfait. Le vendeur et l'admin continuent de voir le
--  catalogue entier : c'est la vitrine qui ferme, pas l'atelier.
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "products read public" ON public.products;
CREATE POLICY "products read public" ON public.products
  FOR SELECT USING (
    (is_listed AND (vendor_id IS NULL OR public.vendor_is_live(vendor_id)))
    OR (vendor_id IS NOT NULL AND public.owns_vendor(vendor_id))
    OR public.is_super_admin()
  );

-- Même chose pour la boutique elle-même.
DROP POLICY IF EXISTS "vendors read public" ON public.vendors;
DROP POLICY IF EXISTS vendors_read_public   ON public.vendors;
CREATE POLICY vendors_read_public ON public.vendors
  FOR SELECT USING (
    public.vendor_is_live(id)
    OR user_id = auth.uid()
    OR public.is_super_admin()
  );

-- ════════════════════════════════════════════════════════════════════════════
--  5. OÙ EN EST LA BOUTIQUE
--     Une seule fonction répond à l'écran : forfait, échéance, places
--     occupées, et ce que le forfait ouvre. L'interface n'a rien à déduire.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vendor_plan_state(p_vendor_id UUID)
RETURNS TABLE (
  plan             TEXT,
  plan_name        TEXT,
  is_active        BOOLEAN,
  expired          BOOLEAN,
  plan_expires_at  TIMESTAMPTZ,
  days_left        INTEGER,
  max_products     INTEGER,
  products_total   INTEGER,
  products_listed  INTEGER,
  slots_left       INTEGER,
  over_quota       BOOLEAN,
  max_couriers     INTEGER,
  couriers_used    INTEGER,
  allows_delivery  BOOLEAN,
  allows_live      BOOLEAN,
  allows_member_discount BOOLEAN,
  allows_stats     BOOLEAN,
  allows_sponsored BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.vendors; sp public.subscription_plans; v_total INT; v_listed INT; v_cour INT;
BEGIN
  IF NOT (public.owns_vendor(p_vendor_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Cette boutique n''est pas la vôtre';
  END IF;

  SELECT * INTO v FROM public.vendors WHERE id = p_vendor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boutique introuvable'; END IF;

  SELECT * INTO sp FROM public.subscription_plans WHERE code = COALESCE(v.plan, 'starter');

  SELECT COUNT(*), COUNT(*) FILTER (WHERE p.is_listed)
    INTO v_total, v_listed
  FROM public.products p WHERE p.vendor_id = p_vendor_id;

  SELECT COUNT(*) INTO v_cour
  FROM public.couriers c WHERE c.vendor_id = p_vendor_id AND c.is_active;

  RETURN QUERY SELECT
    COALESCE(v.plan, 'starter')::TEXT,
    COALESCE(sp.name, 'Gratuit')::TEXT,
    public.vendor_is_live(p_vendor_id),
    (COALESCE(v.plan, 'starter') <> 'starter'
     AND v.plan_expires_at IS NOT NULL
     AND v.plan_expires_at <= NOW()),
    v.plan_expires_at,
    CASE WHEN v.plan_expires_at IS NULL THEN NULL
         ELSE GREATEST(CEIL(EXTRACT(EPOCH FROM (v.plan_expires_at - NOW())) / 86400)::INT, 0) END,
    sp.max_products, v_total::INT, v_listed::INT,
    CASE WHEN sp.max_products IS NULL THEN NULL
         ELSE GREATEST(sp.max_products - v_listed, 0)::INT END,
    (sp.max_products IS NOT NULL AND v_listed > sp.max_products),
    sp.max_couriers, v_cour::INT,
    COALESCE(sp.allows_delivery, FALSE), COALESCE(sp.allows_live, FALSE),
    COALESCE(sp.allows_member_discount, FALSE), COALESCE(sp.allows_stats, FALSE),
    COALESCE(sp.allows_sponsored, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_plan_state(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_plan_state(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. METTRE UN PRODUIT EN VITRINE, OU L'EN RETIRER
--
--  Retirer est toujours permis. Ajouter demande une place libre — et le
--  message dit combien il en reste, pas seulement « refusé ».
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_product_listed(
  p_product_id UUID,
  p_listed     BOOLEAN
)
RETURNS TABLE (is_listed BOOLEAN, products_listed INTEGER, max_products INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_vendor UUID; v_max INT; v_listed INT; v_cur BOOLEAN;
BEGIN
  SELECT p.vendor_id, p.is_listed INTO v_vendor, v_cur
  FROM public.products p WHERE p.id = p_product_id;
  IF v_vendor IS NULL AND v_cur IS NULL THEN RAISE EXCEPTION 'Produit introuvable'; END IF;

  IF NOT (public.owns_vendor(v_vendor) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Ce produit n''est pas le vôtre';
  END IF;

  SELECT sp.max_products INTO v_max
  FROM public.vendors v
  JOIN public.subscription_plans sp ON sp.code = COALESCE(v.plan, 'starter')
  WHERE v.id = v_vendor;

  SELECT COUNT(*) INTO v_listed
  FROM public.products p WHERE p.vendor_id = v_vendor AND p.is_listed;

  IF p_listed AND NOT COALESCE(v_cur, FALSE) THEN
    IF v_max IS NOT NULL AND v_listed >= v_max THEN
      RAISE EXCEPTION 'Ton forfait permet % produits en vitrine, et ils sont tous pris. Retires-en un, ou passe au forfait supérieur.', v_max;
    END IF;
  END IF;

  UPDATE public.products p SET is_listed = p_listed WHERE p.id = p_product_id;

  SELECT COUNT(*) INTO v_listed
  FROM public.products p WHERE p.vendor_id = v_vendor AND p.is_listed;

  RETURN QUERY SELECT p_listed, v_listed::INT, v_max;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_listed(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_product_listed(UUID, BOOLEAN) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. LE PLAFOND TIENT MÊME SANS PASSER PAR L'ÉCRAN
--
--  Un nouveau produit arrive en vitrine s'il reste de la place, en réserve
--  sinon. On ne refuse pas la création : le vendeur garde son travail, il
--  choisira ce qu'il expose.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_product_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_max INT; v_listed INT;
BEGIN
  IF NEW.vendor_id IS NULL OR NOT NEW.is_listed THEN RETURN NEW; END IF;

  SELECT sp.max_products INTO v_max
  FROM public.vendors v
  JOIN public.subscription_plans sp ON sp.code = COALESCE(v.plan, 'starter')
  WHERE v.id = NEW.vendor_id;

  IF v_max IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_listed
  FROM public.products p
  WHERE p.vendor_id = NEW.vendor_id AND p.is_listed AND p.id <> NEW.id;

  IF v_listed >= v_max THEN NEW.is_listed := FALSE; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_quota ON public.products;
CREATE TRIGGER products_quota
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_quota();

-- ════════════════════════════════════════════════════════════════════════════
--  7 bis. LES DEUX AUTRES PLAFONDS : LIVREURS ET PHOTOS
--
--  Contrairement au catalogue, ceux-là refusent franchement : un livreur de
--  trop ou une photo de trop n'a pas de « réserve » où attendre, et accepter
--  en silence ferait croire que c'est passé.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_courier_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_max INT; v_used INT;
BEGIN
  -- Les livreurs Buyticle (vendor_id NULL) ne dépendent d'aucun forfait.
  IF NEW.vendor_id IS NULL OR NOT NEW.is_active THEN RETURN NEW; END IF;

  SELECT sp.max_couriers INTO v_max
  FROM public.vendors v
  JOIN public.subscription_plans sp ON sp.code = COALESCE(v.plan, 'starter')
  WHERE v.id = NEW.vendor_id;

  IF v_max IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.couriers c
  WHERE c.vendor_id = NEW.vendor_id AND c.is_active AND c.id <> NEW.id;

  IF v_used >= v_max THEN
    RAISE EXCEPTION 'Ton forfait permet % livreur(s), et ils sont tous enregistrés. Désactives-en un, ou passe au forfait supérieur.', v_max;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS couriers_quota ON public.couriers;
CREATE TRIGGER couriers_quota
  BEFORE INSERT OR UPDATE OF is_active, vendor_id ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_courier_quota();

CREATE OR REPLACE FUNCTION public.enforce_photo_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_max INT; v_n INT; v_j JSONB;
BEGIN
  IF NEW.vendor_id IS NULL OR NEW.images IS NULL THEN RETURN NEW; END IF;

  SELECT sp.max_photos_per_product INTO v_max
  FROM public.vendors v
  JOIN public.subscription_plans sp ON sp.code = COALESCE(v.plan, 'starter')
  WHERE v.id = NEW.vendor_id;

  IF v_max IS NULL THEN RETURN NEW; END IF;

  -- `images` est un tableau texte ici, du JSON ailleurs selon l'âge de la
  -- base : on compte sans présumer lequel.
  v_j := to_jsonb(NEW.images);
  IF jsonb_typeof(v_j) <> 'array' THEN RETURN NEW; END IF;
  v_n := jsonb_array_length(v_j);

  IF v_n > v_max THEN
    RAISE EXCEPTION 'Ton forfait permet % photo(s) par produit ; celui-ci en a %.', v_max, v_n;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_photo_quota ON public.products;
CREATE TRIGGER products_photo_quota
  BEFORE INSERT OR UPDATE OF images ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_quota();

-- ════════════════════════════════════════════════════════════════════════════
--  8. CHANGER DE FORFAIT REMET LA VITRINE À SA TAILLE
--
--  Monter de forfait rouvre tout : personne ne s'est jamais plaint d'être
--  trop visible.
--
--  Descendre pose la question inverse. Laisser 300 produits exposés sur un
--  forfait qui en permet 20 viderait la limite de son sens ; les masquer au
--  hasard effacerait peut-être ce qui fait vivre la boutique. On garde donc
--  ce qui se vend — ventes d'abord, plus récent ensuite — et on met le reste
--  en réserve. Rien n'est supprimé, et le vendeur reprend la main aussitôt :
--  il retire un produit de la vitrine, il en expose un autre, autant de fois
--  qu'il veut, dans la limite de sa formule.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.on_vendor_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_max INT; v_listed INT; v_total INT;
BEGIN
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan THEN RETURN NEW; END IF;

  SELECT sp.max_products INTO v_max
  FROM public.subscription_plans sp WHERE sp.code = COALESCE(NEW.plan, 'starter');

  SELECT COUNT(*) FILTER (WHERE is_listed), COUNT(*)
    INTO v_listed, v_total
  FROM public.products WHERE vendor_id = NEW.id;

  -- Forfait plus large, ou illimité : on rouvre tout.
  IF v_max IS NULL OR v_max >= v_total THEN
    UPDATE public.products p SET is_listed = TRUE
     WHERE p.vendor_id = NEW.id AND NOT p.is_listed;
    RETURN NEW;
  END IF;

  -- Forfait plus étroit que la vitrine actuelle : on la ramène au plafond.
  IF v_listed > v_max THEN
    UPDATE public.products p SET is_listed = FALSE
     WHERE p.vendor_id = NEW.id AND p.is_listed
       AND p.id NOT IN (
         SELECT q.id FROM (
           SELECT pr.id,
                  COALESCE((SELECT SUM(oi.quantity)
                              FROM public.order_items oi
                              JOIN public.orders o ON o.id = oi.order_id
                             WHERE oi.product_id = pr.id
                               AND o.status <> 'cancelled'), 0) AS sold
             FROM public.products pr
            WHERE pr.vendor_id = NEW.id AND pr.is_listed
            ORDER BY sold DESC, pr.created_at DESC
            LIMIT v_max
         ) q
       );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_plan_change ON public.vendors;
CREATE TRIGGER vendors_plan_change
  AFTER UPDATE OF plan ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.on_vendor_plan_change();
