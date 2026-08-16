-- ════════════════════════════════════════════════════════════════════════════
--  LE PREMIER RAYON — Chaussure & Sport, marché de Mboppi
--
--  Ce fichier monte le rayon en entier : ses familles, ses catégories de
--  recrutement, et le lien entre les deux. Après lui, la console n'a plus qu'à
--  affecter des boutiques.
--
--  DEUX COMPTES QU'IL NE FAUT PAS CONFONDRE — c'est tout l'objet de ce fichier.
--
--    LA CATÉGORIE DE RECRUTEMENT, c'est ce sur quoi on va chercher le
--    commerçant, et ce dans quoi il se reconnaît quand on lui parle :
--    « chaussure femme », « basket et sneaker ». Leurs quotas s'additionnent
--    et donnent le total du rayon : 14.
--
--    LA FAMILLE, c'est ce qu'il tient réellement en rayon — souvent trois ou
--    quatre. Elle sert à calculer la couverture, c'est-à-dire la chance qu'une
--    demande trouve preneur. Les porteurs de toutes les familles s'additionnent
--    bien au-delà de 14, et c'est normal.
--
--    Douze porteurs de chaussures dans un rayon de quatorze boutiques n'est
--    pas une contradiction : le vendeur de baskets en vend aussi.
--
--  LE LIEN entre les deux est une SUGGESTION, pas une contrainte. Il dit ce
--  qu'une boutique de telle catégorie tient d'habitude, pour que la console
--  coche les familles d'avance. L'équipe terrain corrige ensuite d'après ce
--  qu'elle a vu sur l'étagère — c'est elle qui a raison, pas la table.
--
--  Les nombres de variantes viennent du document 2. Ils sont posés de mémoire
--  et doivent être recomptés sur place : une heure par famille. C'est la seule
--  donnée saisie du modèle, tout le reste en découle.
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
       AND p.proname IN ('admin_categories', 'admin_maj_categorie',
                         'admin_supprimer_categorie', 'admin_familles_suggerees')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LES CATÉGORIES DE RECRUTEMENT
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.categories_rayon (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rayon_id    UUID NOT NULL REFERENCES public.rayons(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  -- Combien de boutiques on veut sur cette catégorie. La somme des quotas est
  -- le total du rayon, et c'est la liste de courses de l'équipe terrain.
  quota       INTEGER NOT NULL DEFAULT 1 CHECK (quota > 0),
  profil      TEXT NOT NULL DEFAULT 'emettrice'
              CHECK (profil IN ('receveuse', 'emettrice', 'specialiste', 'service')),
  genre       TEXT NOT NULL DEFAULT 'produit' CHECK (genre IN ('produit', 'service')),
  abonnement  INTEGER NOT NULL DEFAULT 15000,
  ordre       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_rayon_uq
  ON public.categories_rayon (rayon_id, lower(nom));

-- Ce qu'une boutique de cette catégorie tient d'habitude. Suggestion, pas règle.
CREATE TABLE IF NOT EXISTS public.categorie_famille (
  categorie_id UUID NOT NULL REFERENCES public.categories_rayon(id) ON DELETE CASCADE,
  famille_id   UUID NOT NULL REFERENCES public.familles(id)         ON DELETE CASCADE,
  PRIMARY KEY (categorie_id, famille_id)
);

ALTER TABLE public.categories_rayon  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorie_famille ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_rayon_read ON public.categories_rayon;
CREATE POLICY categories_rayon_read ON public.categories_rayon FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS categorie_famille_read ON public.categorie_famille;
CREATE POLICY categorie_famille_read ON public.categorie_famille FOR SELECT USING (TRUE);

-- ════════════════════════════════════════════════════════════════════════════
--  2. LES FONCTIONS DE LA CONSOLE
-- ════════════════════════════════════════════════════════════════════════════

-- L'état du recrutement, catégorie par catégorie : combien il en faut, combien
-- on en a. C'est la liste de courses, et elle se lit dans cet ordre.
CREATE OR REPLACE FUNCTION public.admin_categories(p_rayon_id UUID)
RETURNS TABLE (
  id UUID, nom TEXT, quota INTEGER, profil TEXT, genre TEXT, abonnement INTEGER,
  pourvues INTEGER, manque INTEGER, familles TEXT, familles_ids UUID[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;
  RETURN QUERY
  SELECT c.id, c.nom, c.quota, c.profil, c.genre, c.abonnement,
         (SELECT COUNT(*)::INTEGER FROM public.boutique_rayon br
           WHERE br.rayon_id = p_rayon_id AND br.actif
             AND lower(br.categorie) = lower(c.nom)),
         GREATEST(0, c.quota - (SELECT COUNT(*)::INTEGER FROM public.boutique_rayon br
                                 WHERE br.rayon_id = p_rayon_id AND br.actif
                                   AND lower(br.categorie) = lower(c.nom))),
         (SELECT string_agg(f.nom, ' · ' ORDER BY f.nom)
            FROM public.categorie_famille cf JOIN public.familles f ON f.id = cf.famille_id
           WHERE cf.categorie_id = c.id),
         (SELECT COALESCE(array_agg(cf.famille_id), '{}')
            FROM public.categorie_famille cf WHERE cf.categorie_id = c.id)
    FROM public.categories_rayon c
   WHERE c.rayon_id = p_rayon_id
   ORDER BY c.ordre, c.nom;
END
$$;

-- Créer ou modifier une catégorie, avec les familles qu'elle suggère.
CREATE OR REPLACE FUNCTION public.admin_maj_categorie(
  p_rayon_id UUID, p_nom TEXT, p_quota INTEGER DEFAULT 1,
  p_profil TEXT DEFAULT 'emettrice', p_genre TEXT DEFAULT 'produit',
  p_abonnement INTEGER DEFAULT 15000, p_familles UUID[] DEFAULT NULL,
  p_categorie_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  IF p_categorie_id IS NULL THEN
    INSERT INTO public.categories_rayon (rayon_id, nom, quota, profil, genre, abonnement)
    VALUES (p_rayon_id, p_nom, p_quota, p_profil, p_genre, p_abonnement)
    ON CONFLICT (rayon_id, lower(nom)) DO UPDATE
      SET quota = EXCLUDED.quota, profil = EXCLUDED.profil,
          genre = EXCLUDED.genre, abonnement = EXCLUDED.abonnement
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.categories_rayon
       SET nom = p_nom, quota = p_quota, profil = p_profil,
           genre = p_genre, abonnement = p_abonnement
     WHERE id = p_categorie_id
    RETURNING id INTO v_id;
  END IF;

  IF p_familles IS NOT NULL THEN
    DELETE FROM public.categorie_famille WHERE categorie_id = v_id;
    INSERT INTO public.categorie_famille (categorie_id, famille_id)
    SELECT v_id, unnest(p_familles) ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_supprimer_categorie(p_categorie_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;
  -- Les boutiques déjà rattachées gardent leur libellé de catégorie : on
  -- supprime une ligne de la liste de courses, pas l'histoire du rayon.
  DELETE FROM public.categories_rayon WHERE id = p_categorie_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_categories(UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_supprimer_categorie(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_maj_categorie(UUID, TEXT, INTEGER, TEXT, TEXT, INTEGER, UUID[], UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  3. LE RAYON, SES FAMILLES, SES CATÉGORIES
--
--  Tout ce qui suit est rejouable : on ne recrée rien qui existe déjà, et on
--  ne touche à aucune boutique.
-- ════════════════════════════════════════════════════════════════════════════
DO $seed$
DECLARE
  v_rayon UUID;
  f_chauss UUID; f_basket UUID; f_maillot UUID; f_access UUID; f_cirage UUID;
  c RECORD;
  -- Les catégories, dans l'ordre où l'équipe terrain doit les pourvoir.
  -- nom · quota · profil · genre · abonnement · familles suggérées
BEGIN
  ------------------------------------------------------------------ le rayon
  SELECT id INTO v_rayon FROM public.rayons
   WHERE ville = 'Douala' AND zone = 'Marché Mboppi' AND nom = 'Chaussure & Sport';

  IF v_rayon IS NULL THEN
    INSERT INTO public.rayons (nom, zone, ville, perimetre_m,
                               min_boutiques, max_boutiques, plancher_recus, statut)
    VALUES ('Chaussure & Sport', 'Marché Mboppi', 'Douala', 500, 8, 16, 60, 'construction')
    RETURNING id INTO v_rayon;
  END IF;

  ---------------------------------------------------------------- les familles
  -- Le nombre de variantes est la seule donnée saisie. Il commande p, les
  -- porteurs nécessaires, la couverture et l'ouverture de la famille. Ces
  -- valeurs viennent du document 2 et doivent être recomptées sur place :
  -- une heure par famille, dans une boutique qui la tient.
  INSERT INTO public.familles (rayon_id, nom, variantes, role) VALUES
    (v_rayon, 'Chaussures',                120, 'moteur'),
    (v_rayon, 'Baskets',                    80, 'moteur'),
    (v_rayon, 'Maillots',                   40, 'appoint'),
    (v_rayon, 'Chaussettes, lacets, sacs',  12, 'appoint'),
    (v_rayon, 'Cirage et entretien',         6, 'service')
  ON CONFLICT (rayon_id, lower(nom)) DO NOTHING;

  SELECT id INTO f_chauss  FROM public.familles WHERE rayon_id = v_rayon AND nom = 'Chaussures';
  SELECT id INTO f_basket  FROM public.familles WHERE rayon_id = v_rayon AND nom = 'Baskets';
  SELECT id INTO f_maillot FROM public.familles WHERE rayon_id = v_rayon AND nom = 'Maillots';
  SELECT id INTO f_access  FROM public.familles WHERE rayon_id = v_rayon AND nom = 'Chaussettes, lacets, sacs';
  SELECT id INTO f_cirage  FROM public.familles WHERE rayon_id = v_rayon AND nom = 'Cirage et entretien';

  -------------------------------------------------------------- les catégories
  -- Les quotas s'additionnent à 14. Quatre généralistes tiennent le socle, six
  -- spécialistes bouchent les extrémités où la rupture se concentre — la femme,
  -- l'enfant, la grande pointure, l'occasion — et la cordonnerie est le
  -- sous-rayon de service : elle ne vend presque rien, mais sans elle le cirage
  -- tombe sous son seuil.
  --
  -- On insère directement plutôt que d'appeler admin_maj_categorie : dans
  -- l'éditeur SQL il n'y a pas de session utilisateur, donc pas d'auth.uid(),
  -- et le garde-fou super admin de cette fonction refuserait le seed.
  INSERT INTO public.categories_rayon (rayon_id, nom, quota, profil, genre, abonnement, ordre) VALUES
    (v_rayon, 'Chaussure généraliste',          4, 'receveuse',   'produit', 15000,  1),
    (v_rayon, 'Basket et sneaker',              2, 'emettrice',   'produit', 15000,  2),
    (v_rayon, 'Chaussure femme',                1, 'emettrice',   'produit', 15000,  3),
    (v_rayon, 'Chaussure homme, ville et cuir', 1, 'specialiste', 'produit', 15000,  4),
    (v_rayon, 'Chaussure enfant',               1, 'specialiste', 'produit', 15000,  5),
    (v_rayon, 'Chaussure d''occasion',          1, 'emettrice',   'produit', 15000,  6),
    (v_rayon, 'Sandale, claquette, tong',       1, 'specialiste', 'produit',  5000,  7),
    (v_rayon, 'Sport, maillot et crampon',      1, 'emettrice',   'produit', 15000,  8),
    -- Elle n'apporte rien à la chaussure. Elle est là parce que sans elle les
    -- maillots tombent à six porteurs alors qu'il en faut sept, et une famille
    -- sous son seuil produit des relais ratés.
    (v_rayon, 'Maillot',                        1, 'specialiste', 'produit',  5000,  9),
    -- Le sous-rayon de service. Cinq clients reçus par mois, et elle en envoie
    -- autant : elle ne peut pas payer le tarif plein.
    (v_rayon, 'Cirage et cordonnerie',          1, 'service',     'produit',  5000, 10)
  ON CONFLICT (rayon_id, lower(nom)) DO UPDATE
    SET quota = EXCLUDED.quota, profil = EXCLUDED.profil,
        genre = EXCLUDED.genre, abonnement = EXCLUDED.abonnement,
        ordre = EXCLUDED.ordre;

  --------------------------------------------- ce que chaque catégorie tient
  -- Suggestion, pas contrainte : la console coche ces familles d'avance et
  -- l'équipe terrain corrige d'après ce qu'elle a vu sur l'étagère.
  FOR c IN SELECT id, nom FROM public.categories_rayon WHERE rayon_id = v_rayon LOOP
    DELETE FROM public.categorie_famille WHERE categorie_id = c.id;
    INSERT INTO public.categorie_famille (categorie_id, famille_id)
    SELECT c.id, f
      FROM unnest(
        CASE c.nom
          WHEN 'Chaussure généraliste'          THEN ARRAY[f_chauss, f_basket, f_maillot, f_access, f_cirage]
          WHEN 'Basket et sneaker'              THEN ARRAY[f_basket, f_chauss, f_access]
          WHEN 'Chaussure femme'                THEN ARRAY[f_chauss, f_basket, f_access]
          WHEN 'Chaussure homme, ville et cuir' THEN ARRAY[f_chauss, f_access, f_cirage]
          WHEN 'Chaussure enfant'               THEN ARRAY[f_chauss, f_basket, f_access]
          WHEN 'Chaussure d''occasion'          THEN ARRAY[f_chauss, f_basket, f_maillot]
          WHEN 'Sandale, claquette, tong'       THEN ARRAY[f_chauss, f_access]
          WHEN 'Sport, maillot et crampon'      THEN ARRAY[f_maillot, f_basket, f_chauss, f_access]
          WHEN 'Maillot'                        THEN ARRAY[f_maillot]
          WHEN 'Cirage et cordonnerie'          THEN ARRAY[f_cirage, f_access]
          ELSE ARRAY[]::UUID[]
        END) AS f
    ON CONFLICT DO NOTHING;
  END LOOP;

  PERFORM public.rafraichir_familles(v_rayon);

  RAISE NOTICE 'Rayon « Chaussure & Sport » prêt : %', v_rayon;
  RAISE NOTICE '5 familles, 10 catégories, 14 boutiques à recruter.';
END
$seed$;

-- ════════════════════════════════════════════════════════════════════════════
--  4. OÙ ON EN EST
--
--  À lancer après, et à relancer à chaque boutique recrutée. La première
--  requête est la liste de courses ; la seconde dit si le rayon peut ouvrir.
-- ════════════════════════════════════════════════════════════════════════════
-- select * from public.admin_categories(
--   (select id from public.rayons where nom = 'Chaussure & Sport'));
--
-- select * from public.rayon_etat(
--   (select id from public.rayons where nom = 'Chaussure & Sport'));
