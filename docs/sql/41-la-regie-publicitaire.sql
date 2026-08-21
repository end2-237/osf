-- ════════════════════════════════════════════════════════════════════════════
--  41 — LA RÉGIE PUBLICITAIRE
--
--  Jusqu'ici la publicité était écrite en dur : trois diapositives dans le
--  code de l'application mobile, et un bandeau web qui tirait une boutique au
--  hasard parmi les actives. Deux conséquences, et la seconde est la pire :
--
--  · changer une campagne demandait un déploiement — donc on ne changeait
--    jamais rien ;
--  · une boutique qui PAIE pour être mise en avant n'avait aucun moyen de
--    l'être davantage qu'une autre. On vendait une place qu'on ne savait pas
--    livrer.
--
--  Deux tables donc, et elles ne se confondent pas.
--
--  `pubs` porte les CRÉATIONS : une image, un texte, une destination, un
--  emplacement. C'est de l'affichage.
--
--  `sponsorisations` porte les CONTRATS : telle boutique est mise en avant du
--  tel jour au tel jour. C'est du commerce. Une sponsorisation n'a pas de
--  visuel — elle change le classement et fait remonter la boutique dans les
--  emplacements prévus pour ça.
--
--  Les mêler dans une table unique aurait paru économe. Ça aurait surtout
--  rendu impossible la seule question qui compte à la facturation : combien
--  de jours cette boutique a-t-elle été réellement mise en avant.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ─── ① Les créations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pubs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Où elle s'affiche. Le nom dit la FORME, pas l'écran : la même diapositive
  -- large sert l'accueil et le catalogue, et c'est voulu — une création
  -- refaite par écran ne serait jamais tenue à jour.
  --   'carrousel' le grand carrousel du haut (mobile : accueil)
  --   'slide'     rail horizontal large      (mobile : accueil, catalogue)
  --   'carte'     une case de la grille      (mobile : accueil, catalogue, recherche)
  --   'story'     le format plein écran      (mobile : rail de stories)
  --   'bandeau'   la bande fine du site      (web)
  emplacement  TEXT NOT NULL,

  eyebrow      TEXT,                 -- la sur-titre en capitales
  titre        TEXT NOT NULL,
  sous_titre   TEXT,
  action       TEXT,                 -- le libellé du bouton
  image_url    TEXT,                 -- si nul, on rend le fond coloré + icône

  -- L'habillage quand il n'y a pas d'image. Une campagne sans visuel doit
  -- rester présentable : c'est le cas le plus fréquent au début.
  fond         TEXT DEFAULT '#141B4D',
  teinte       TEXT,
  icone        TEXT,                 -- nom sémantique, cf. components/Icone.jsx

  -- Où elle mène. Un seul de ces trois est rempli.
  cible_type   TEXT CHECK (cible_type IN ('route', 'boutique', 'produit', 'externe')),
  cible_id     UUID,                 -- boutique ou produit
  cible_url    TEXT,                 -- route interne (/relais) ou URL externe

  -- La fenêtre. NULL des deux côtés = permanente.
  debut        TIMESTAMPTZ,
  fin          TIMESTAMPTZ,
  actif        BOOLEAN NOT NULL DEFAULT TRUE,

  -- Le poids décide de l'ordre. Deux campagnes de même poids sortent dans un
  -- ordre stable (par date de création), jamais aléatoire : une régie qui
  -- change d'ordre à chaque chargement rend toute vérification impossible.
  poids        INT NOT NULL DEFAULT 100,

  vues         BIGINT NOT NULL DEFAULT 0,
  clics        BIGINT NOT NULL DEFAULT 0,

  -- À qui elle appartient, quand une boutique achète sa propre création.
  vendor_id    UUID REFERENCES public.vendors(id) ON DELETE CASCADE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La contrainte est posée à part, et rejouable : ajouter un emplacement plus
-- tard ne doit pas obliger à recréer la table ni à deviner si la migration a
-- déjà tourné.
ALTER TABLE public.pubs DROP CONSTRAINT IF EXISTS pubs_emplacement_check;
ALTER TABLE public.pubs ADD CONSTRAINT pubs_emplacement_check
  CHECK (emplacement IN ('carrousel', 'slide', 'carte', 'story', 'bandeau'));

CREATE INDEX IF NOT EXISTS pubs_emplacement_idx
  ON public.pubs (emplacement, actif, poids DESC, created_at);

-- ─── ② Les contrats de mise en avant ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sponsorisations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,

  debut       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fin         TIMESTAMPTZ,           -- NULL = jusqu'à révocation
  actif       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Ce que ça couvre. « boutique » remonte la boutique dans les listes ;
  -- « contenu » remonte AUSSI ses articles dans les grilles. Le second coûte
  -- plus cher parce qu'il touche beaucoup plus de pages.
  portee      TEXT NOT NULL DEFAULT 'boutique'
              CHECK (portee IN ('boutique', 'contenu')),

  poids       INT NOT NULL DEFAULT 100,
  montant     NUMERIC(12,2),         -- ce qui a été facturé, pour la trace
  note        TEXT,

  cree_par    UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsorisations_vendor_idx
  ON public.sponsorisations (vendor_id, actif, debut DESC);

-- ─── ③ Ce que lisent les applications ───────────────────────────────────────

-- La fenêtre se juge ICI, en base, jamais dans le client. Un téléphone dont
-- l'horloge est fausse — et il y en a — afficherait sinon une campagne
-- terminée, ou raterait celle du jour.
CREATE OR REPLACE FUNCTION public.pubs_actives(p_emplacement TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, emplacement TEXT, eyebrow TEXT, titre TEXT, sous_titre TEXT,
  action TEXT, image_url TEXT, fond TEXT, teinte TEXT, icone TEXT,
  cible_type TEXT, cible_id UUID, cible_url TEXT, poids INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.emplacement, p.eyebrow, p.titre, p.sous_titre,
         p.action, p.image_url, p.fond, p.teinte, p.icone,
         p.cible_type, p.cible_id, p.cible_url, p.poids
  FROM public.pubs p
  WHERE p.actif
    AND (p_emplacement IS NULL OR p.emplacement = p_emplacement)
    AND (p.debut IS NULL OR p.debut <= now())
    AND (p.fin   IS NULL OR p.fin   >= now())
  ORDER BY p.poids DESC, p.created_at
  LIMIT 20;
$$;

-- La boutique mise en avant. On exclut celle qu'on regarde déjà : proposer à
-- quelqu'un la boutique où il se trouve n'est pas une publicité, c'est un
-- bug qui se voit.
CREATE OR REPLACE FUNCTION public.boutique_sponsorisee(p_exclure UUID DEFAULT NULL)
RETURNS TABLE (vendor_id UUID, shop_name TEXT, logo TEXT, portee TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.shop_name, v.logo_url, s.portee
  FROM public.sponsorisations s
  JOIN public.vendors v ON v.id = s.vendor_id
  WHERE s.actif
    AND v.is_active
    AND s.debut <= now()
    AND (s.fin IS NULL OR s.fin >= now())
    AND (p_exclure IS NULL OR v.id <> p_exclure)
  -- Le poids décide, puis le hasard départage les ex æquo : sans ce hasard,
  -- deux boutiques au même tarif n'auraient jamais la même exposition, et la
  -- seconde paierait pour rien.
  ORDER BY s.poids DESC, random()
  LIMIT 1;
$$;

-- Les compteurs. `SECURITY DEFINER` parce qu'un visiteur anonyme doit pouvoir
-- incrémenter sans avoir le droit d'écrire dans la table — sinon il pourrait
-- aussi bien réécrire la campagne.
CREATE OR REPLACE FUNCTION public.pub_vue(p_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.pubs SET vues = vues + 1 WHERE id = p_id; $$;

CREATE OR REPLACE FUNCTION public.pub_clic(p_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.pubs SET clics = clics + 1 WHERE id = p_id; $$;

GRANT EXECUTE ON FUNCTION public.pubs_actives(TEXT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boutique_sponsorisee(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pub_vue(UUID)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pub_clic(UUID)           TO anon, authenticated;

-- ─── ④ Les droits ───────────────────────────────────────────────────────────

ALTER TABLE public.pubs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pubs_lecture ON public.pubs;
CREATE POLICY pubs_lecture ON public.pubs
  FOR SELECT USING (
    actif
    AND (debut IS NULL OR debut <= now())
    AND (fin   IS NULL OR fin   >= now())
  );

-- Le super-admin voit et écrit tout, y compris les campagnes éteintes : c'est
-- lui qui les rallume.
DROP POLICY IF EXISTS pubs_admin ON public.pubs;
CREATE POLICY pubs_admin ON public.pubs
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Une boutique voit ses propres créations, même éteintes. Elle ne peut pas en
-- créer : une régie où l'annonceur se sert lui-même n'est plus une régie.
DROP POLICY IF EXISTS pubs_proprietaire ON public.pubs;
CREATE POLICY pubs_proprietaire ON public.pubs
  FOR SELECT USING (vendor_id IS NOT NULL AND public.owns_vendor(vendor_id));

DROP POLICY IF EXISTS sponsorisations_admin ON public.sponsorisations;
CREATE POLICY sponsorisations_admin ON public.sponsorisations
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS sponsorisations_proprietaire ON public.sponsorisations;
CREATE POLICY sponsorisations_proprietaire ON public.sponsorisations
  FOR SELECT USING (public.owns_vendor(vendor_id));

-- ─── ⑤ Le dépôt des visuels ─────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('pub-media', 'pub-media', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS pub_media_lecture ON storage.objects;
CREATE POLICY pub_media_lecture ON storage.objects
  FOR SELECT USING (bucket_id = 'pub-media');

DROP POLICY IF EXISTS pub_media_ecriture ON storage.objects;
CREATE POLICY pub_media_ecriture ON storage.objects
  FOR ALL USING (bucket_id = 'pub-media' AND public.is_super_admin())
  WITH CHECK (bucket_id = 'pub-media' AND public.is_super_admin());

-- ─── ⑥ Ce qui existait en dur, versé en base ────────────────────────────────
--  On sème les trois campagnes qui vivaient dans le code de l'application.
--  Sans elles, la première ouverture après cette migration montrerait des
--  emplacements vides — et un emplacement vide se remarque plus qu'une
--  réclame.

INSERT INTO public.pubs (emplacement, eyebrow, titre, sous_titre, action,
                         fond, teinte, icone, cible_type, cible_url, poids)
SELECT * FROM (VALUES
  -- Le guillemet dollar plutôt que l'apostrophe doublée : ces textes en sont
  -- pleins, et une apostrophe oubliée casse la migration entière à la
  -- dernière ligne. Les retours à la ligne sont écrits tels quels.
  ('carrousel', NULL, $t$Commence l'année
avec de bonnes affaires$t$,
   $t$Jusqu'à −33 % sur des milliers d'articles$t$, NULL,
   '#FF6B00', NULL, 'eclair', 'route', '/catalogue', 300),

  ('carrousel', NULL, $t$Livraison gratuite
à Douala$t$,
   $t$Dès 25 000 F d'achat$t$, NULL,
   '#2E7D32', NULL, 'camion', 'route', '/catalogue', 200),

  ('carrousel', NULL, $t$Paiement en 12 fois$t$,
   $t$Sans frais, sur les articles marqués 0-0-24$t$, NULL,
   '#141B4D', NULL, 'cible', 'route', '/catalogue', 100),

  ('slide', $t$Le relais Buyticle$t$, $t$Il ne l'a pas ?
Il t'envoie chez le voisin$t$,
   $t$Et tu paies 5 % moins cher qu'en boutique$t$, $t$Comment ça marche$t$,
   '#141B4D', '#2C3A7D', 'relais', 'route', '/relais', 300),

  ('slide', $t$Ventes flash$t$, $t$Jusqu'à −33 %
sur des milliers d'articles$t$,
   $t$Jusqu'à dimanche minuit$t$, $t$J'en profite$t$,
   '#FF6B00', '#FF8C3A', 'eclair', 'route', '/catalogue', 200),

  ('slide', $t$Douala et Yaoundé$t$, $t$Livraison gratuite
dès 25 000 F$t$,
   $t$Reçu le lendemain, partout en ville$t$, $t$Voir les articles$t$,
   '#00695C', '#00897B', 'camion', 'route', '/catalogue', 100),

  ('carte', $t$Programme de fidélité$t$, $t$Chaque achat te rend des points$t$,
   $t$1 point pour 100 F, à dépenser quand tu veux$t$, $t$Mes bonus$t$,
   '#FF6B00', NULL, 'cadeau', 'route', '/fidelite', 200),

  ('carte', $t$Parrainage$t$, $t$Fais venir un ami,
gagne sur ses achats$t$,
   $t$Ton code marche dès la première commande$t$, $t$Mon code$t$,
   '#141B4D', NULL, 'personnes', 'route', '/parrainage', 100),

  ('story', NULL, $t$Beauté −40 %$t$,
   $t$Sur une sélection de soins et parfums, jusqu'à dimanche.$t$, NULL,
   '#2C6BED', NULL, 'cadeau', 'route', '/catalogue', 300),

  ('story', NULL, $t$Le mois high-tech$t$,
   $t$Téléphones et ordinateurs, payables en douze fois.$t$, NULL,
   '#141B4D', NULL, 'catalogue', 'route', '/catalogue', 200),

  ('story', NULL, $t$Le relais$t$,
   $t$Un vendeur ne l'a pas ? Il t'envoie chez un voisin qui l'a — et tu paies moins cher.$t$,
   $t$Comment ça marche$t$,
   '#00897B', NULL, 'relais', 'route', '/relais', 100)
) AS v(emplacement, eyebrow, titre, sous_titre, action,
       fond, teinte, icone, cible_type, cible_url, poids)
WHERE NOT EXISTS (SELECT 1 FROM public.pubs);

-- ─── ⑦ Vérification ─────────────────────────────────────────────────────────
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.pubs_actives(NULL);
  RAISE NOTICE 'Régie en place. % campagne(s) active(s).', n;
END $$;
