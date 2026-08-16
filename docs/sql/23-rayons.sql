-- ════════════════════════════════════════════════════════════════════════════
--  LES RAYONS — le socle du Relais
--
--  Un rayon est un groupe de boutiques d'un même périmètre de marche, assez
--  complet pour qu'une demande refusée chez l'une trouve preneur chez une
--  autre. Rien du mécanisme ne peut exister avant lui : ni l'appel à
--  disponibilité, ni l'arbitrage, ni la majoration des prix.
--
--  Trois idées, et une seule règle qui les relie.
--
--  1. LA FAMILLE. Un rayon porte des familles de produits — chaussures,
--     baskets, maillots, cirage. Chaque famille a un nombre de variantes, d'où
--     se déduisent la chance qu'un voisin ait l'équivalent et le nombre de
--     boutiques nécessaires :
--
--         p = 2,2 / racine(variantes),  plafonné à 0,60
--         porteurs requis = 1 + ln(0,10) / ln(1 - p)     pour couvrir 90 %
--
--     Une famille tenue par moins de porteurs que nécessaire reste FERMÉE :
--     elle produirait des relais ratés, et un relais raté coûte plus cher
--     qu'une famille absente. Le plancher absolu est de quatre porteurs.
--
--  2. LA BOUTIQUE DANS LE RAYON. Elle y entre sur une catégorie de
--     recrutement, avec un profil — receveuse, émettrice, spécialiste ou
--     service — et un tarif d'abonnement qui n'est pas le même pour toutes.
--
--  3. LE PRIX NET. Le prix saisi par une boutique de rayon EST son prix net :
--     ce qu'elle touche en entier. La plateforme affiche ce prix majoré de
--     13 %, et l'acheteur porte la majoration : 3 % pour Buyticle, 5 % de
--     remise au client, 5 % de bon pour la boutique qui a envoyé.
--
--     La majoration est une propriété du RAYON, pas du produit. Une boutique
--     hors rayon garde son affichage actuel — rien à migrer, rien à recalculer.
--
--  Aucune table de personnel : un seul compte par boutique, celui du patron.
--  Il le connecte sur le téléphone de celui qui tient le comptoir.
--
--  Idempotent : rejouable sans dommage, dans n'importe quel ordre.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('famille_p', 'famille_porteurs_requis', 'famille_couverture',
                         'rafraichir_familles', 'vendor_rayon', 'prix_affiche',
                         'prix_client_relaye', 'rayon_etat')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LES CONSTANTES DE LA MAJORATION
--
--  Elles vivent dans platform_policy, qui existe déjà, pour qu'on puisse les
--  changer sans déploiement. Elles ne sont PAS par boutique : c'est tout
--  l'intérêt d'un prix ferme et connu d'avance.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.platform_policy
  ADD COLUMN IF NOT EXISTS majoration_bps      INTEGER NOT NULL DEFAULT 1300,  -- 13,00 %
  ADD COLUMN IF NOT EXISTS part_buyticle_bps   INTEGER NOT NULL DEFAULT  300,  --  3,00 %
  ADD COLUMN IF NOT EXISTS part_remise_bps     INTEGER NOT NULL DEFAULT  500,  --  5,00 %
  ADD COLUMN IF NOT EXISTS part_bon_bps        INTEGER NOT NULL DEFAULT  500,  --  5,00 %
  -- Sans envoyeur, les 5 % du bon n'ont pas de destinataire : ils vont au
  -- client. Revenir seul coûte donc moins cher que d'être envoyé.
  ADD COLUMN IF NOT EXISTS remise_directe_bps  INTEGER NOT NULL DEFAULT 1000,  -- 10,00 %
  ADD COLUMN IF NOT EXISTS bon_validite_heures INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS appel_secondes      INTEGER NOT NULL DEFAULT 30;

ALTER TABLE public.platform_policy
  ADD CONSTRAINT platform_policy_majoration_coherente
  CHECK (part_buyticle_bps + part_remise_bps + part_bon_bps = majoration_bps)
  NOT VALID;

-- ════════════════════════════════════════════════════════════════════════════
--  2. LE RAYON
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rayons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             TEXT NOT NULL,
  zone            TEXT NOT NULL,                    -- « Marché Mboppi », « Akwa »
  ville           TEXT NOT NULL DEFAULT 'Douala',
  -- Le périmètre de marche. Au-delà, le relais n'est plus crédible : le client
  -- doit constater tout de suite que ça marche.
  perimetre_m     INTEGER NOT NULL DEFAULT 500,
  -- Le plancher et le plafond du chapitre 3 de la stratégie.
  min_boutiques   INTEGER NOT NULL DEFAULT 8,
  max_boutiques   INTEGER NOT NULL DEFAULT 16,
  -- Le minimum mensuel de la boutique la mieux fournie : en dessous, elle
  -- passe première à l'arbitrage. Hypothèse non mesurée, donc paramétrable.
  plancher_recus  INTEGER NOT NULL DEFAULT 60,
  statut          TEXT NOT NULL DEFAULT 'construction'
                  CHECK (statut IN ('construction', 'actif', 'suspendu')),
  ouvert_le       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS rayons_zone_nom_uq
  ON public.rayons (ville, zone, nom);

-- ════════════════════════════════════════════════════════════════════════════
--  3. LA FAMILLE, ET LE CALCUL QUI DÉCIDE DE SON OUVERTURE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.familles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rayon_id        UUID NOT NULL REFERENCES public.rayons(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  -- La seule donnée à mesurer sur le terrain : une heure de comptage.
  variantes       INTEGER NOT NULL CHECK (variantes > 0),
  role            TEXT NOT NULL DEFAULT 'appoint'
                  CHECK (role IN ('moteur', 'appoint', 'service')),
  -- Recalculés par rafraichir_familles(), jamais saisis à la main.
  porteurs        INTEGER NOT NULL DEFAULT 0,
  porteurs_requis INTEGER NOT NULL DEFAULT 0,
  couverture      NUMERIC(5,4) NOT NULL DEFAULT 0,
  ouverte         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS familles_rayon_nom_uq
  ON public.familles (rayon_id, lower(nom));

-- p = 2,2 / racine(variantes), plafonné à 0,60.
-- Le coefficient a été calé pour retrouver les nombres du chapitre 4 de la
-- stratégie, qui avaient été posés à la main. Il reste à vérifier au terrain :
-- à 1,8 la chaussure demande quinze porteurs, à 2,6 elle en demande onze.
CREATE OR REPLACE FUNCTION public.famille_p(p_variantes INTEGER)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT LEAST(0.60, 2.2 / SQRT(GREATEST(p_variantes, 1)::NUMERIC));
$$;

-- Nombre de porteurs pour couvrir 90 % des demandes, jamais moins de quatre :
-- en dessous, le départ d'une seule boutique fait s'effondrer la famille.
CREATE OR REPLACE FUNCTION public.famille_porteurs_requis(p_variantes INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(4, CEIL(1 + LN(0.10) / LN(1 - public.famille_p(p_variantes)))::INTEGER);
$$;

CREATE OR REPLACE FUNCTION public.famille_couverture(p_variantes INTEGER, p_porteurs INTEGER)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_porteurs < 2 THEN 0::NUMERIC
              ELSE ROUND(1 - POWER(1 - public.famille_p(p_variantes), p_porteurs - 1), 4)
         END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  4. LA BOUTIQUE DANS LE RAYON
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.boutique_rayon (
  vendor_id       UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  rayon_id        UUID NOT NULL REFERENCES public.rayons(id)  ON DELETE CASCADE,
  categorie       TEXT NOT NULL,                    -- « Chaussure généraliste »
  profil          TEXT NOT NULL DEFAULT 'emettrice'
                  CHECK (profil IN ('receveuse', 'emettrice', 'specialiste', 'service')),
  -- Vend des articles, ou une prestation. Le second n'est jamais receveur d'un
  -- client relayé : il émet, et il peut demander une livraison.
  genre           TEXT NOT NULL DEFAULT 'produit'
                  CHECK (genre IN ('produit', 'service')),
  -- 15 000 F, ou 5 000 F pour les boutiques qui reçoivent peu — elles n'ont
  -- pas été recrutées pour recevoir mais pour boucher un trou de couverture.
  abonnement_fcfa INTEGER NOT NULL DEFAULT 15000,
  -- Le temps de preuve ne se ferme pas sur une date mais sur un compteur.
  preuve_seuil    INTEGER NOT NULL DEFAULT 20,
  preuve_close_le TIMESTAMPTZ,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  entre_le        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sorti_le        TIMESTAMPTZ,
  PRIMARY KEY (vendor_id, rayon_id)
);

CREATE INDEX IF NOT EXISTS boutique_rayon_rayon_idx
  ON public.boutique_rayon (rayon_id) WHERE actif;

-- Quelles familles la boutique tient réellement — souvent trois ou quatre.
-- C'est ce lien qui donne le nombre de porteurs, et donc la couverture.
CREATE TABLE IF NOT EXISTS public.boutique_famille (
  vendor_id   UUID NOT NULL REFERENCES public.vendors(id)   ON DELETE CASCADE,
  famille_id  UUID NOT NULL REFERENCES public.familles(id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_id, famille_id)
);

CREATE INDEX IF NOT EXISTS boutique_famille_famille_idx
  ON public.boutique_famille (famille_id);

-- ════════════════════════════════════════════════════════════════════════════
--  5. RECALCUL — porteurs, couverture, ouverture
--
--  Appelé après chaque entrée ou sortie de boutique. Une famille s'ouvre
--  quand elle a ses porteurs, et se referme quand elle les perd : c'est
--  automatique, personne ne décide.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rafraichir_familles(p_rayon_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  WITH compte AS (
    SELECT f.id,
           COUNT(*) FILTER (
             WHERE br.actif AND br.genre = 'produit'
           )::INTEGER AS porteurs
      FROM public.familles f
      LEFT JOIN public.boutique_famille bf ON bf.famille_id = f.id
      LEFT JOIN public.boutique_rayon   br ON br.vendor_id  = bf.vendor_id
                                          AND br.rayon_id   = f.rayon_id
     WHERE p_rayon_id IS NULL OR f.rayon_id = p_rayon_id
     GROUP BY f.id
  )
  UPDATE public.familles f
     SET porteurs        = c.porteurs,
         porteurs_requis = public.famille_porteurs_requis(f.variantes),
         couverture      = public.famille_couverture(f.variantes, c.porteurs),
         ouverte         = c.porteurs >= public.famille_porteurs_requis(f.variantes)
    FROM compte c
   WHERE c.id = f.id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LE PRIX
--
--  vendor_rayon() dit si une boutique appartient à un rayon actif. C'est la
--  seule condition de la majoration : hors rayon, le prix s'affiche tel quel.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vendor_rayon(p_vendor_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT br.rayon_id
    FROM public.boutique_rayon br
    JOIN public.rayons r ON r.id = br.rayon_id
   WHERE br.vendor_id = p_vendor_id
     AND br.actif
     AND r.statut = 'actif'
   LIMIT 1;
$$;

-- Le prix affiché sur la plateforme. Prix net majoré si la boutique est en
-- rayon, prix tel quel sinon.
CREATE OR REPLACE FUNCTION public.prix_affiche(p_vendor_id UUID, p_prix_net NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE m INTEGER;
BEGIN
  IF public.vendor_rayon(p_vendor_id) IS NULL THEN
    RETURN ROUND(p_prix_net)::INTEGER;
  END IF;
  SELECT majoration_bps INTO m FROM public.platform_policy WHERE id;
  RETURN ROUND(p_prix_net * (1 + m / 10000.0))::INTEGER;
END
$$;

-- Ce que le client paie réellement. Relayé, il garde 5 % de remise ; venu de
-- lui-même, il en a 10 %, parce que les 5 % du bon n'ont pas de destinataire.
CREATE OR REPLACE FUNCTION public.prix_client_relaye(
  p_vendor_id UUID, p_prix_net NUMERIC, p_relaye BOOLEAN DEFAULT TRUE
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pol public.platform_policy; remise INTEGER;
BEGIN
  IF public.vendor_rayon(p_vendor_id) IS NULL THEN
    RETURN ROUND(p_prix_net)::INTEGER;
  END IF;
  SELECT * INTO pol FROM public.platform_policy WHERE id;
  remise := CASE WHEN p_relaye THEN pol.part_remise_bps ELSE pol.remise_directe_bps END;
  RETURN ROUND(p_prix_net * (1 + (pol.majoration_bps - remise) / 10000.0))::INTEGER;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  7. L'ÉTAT D'UN RAYON, pour l'équipe terrain
--
--  Ce qui manque, et ce qui bloque l'ouverture. Le rayon ne s'ouvre pas quand
--  la première boutique signe : il s'ouvre quand la famille motrice atteint
--  son seuil. Avant, chaque relais a une chance sur deux d'échouer.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rayon_etat(p_rayon_id UUID)
RETURNS TABLE (
  famille          TEXT,
  role             TEXT,
  variantes        INTEGER,
  p                NUMERIC,
  porteurs         INTEGER,
  porteurs_requis  INTEGER,
  manque           INTEGER,
  couverture       NUMERIC,
  ouverte          BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.nom, f.role, f.variantes,
         ROUND(public.famille_p(f.variantes), 2),
         f.porteurs, f.porteurs_requis,
         GREATEST(0, f.porteurs_requis - f.porteurs),
         f.couverture, f.ouverte
    FROM public.familles f
   WHERE f.rayon_id = p_rayon_id
   ORDER BY (f.role = 'moteur') DESC, f.variantes DESC;
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  8. QUI VOIT QUOI
--
--  Les rayons et les familles sont publics : un client doit pouvoir voir que
--  la boutique appartient à un rayon, c'est ce qui rend le relais crédible.
--  L'appartenance d'une boutique l'est aussi. Rien de sensible ici.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rayons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_rayon   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_famille ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rayons_read ON public.rayons;
CREATE POLICY rayons_read ON public.rayons FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS familles_read ON public.familles;
CREATE POLICY familles_read ON public.familles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS boutique_rayon_read ON public.boutique_rayon;
CREATE POLICY boutique_rayon_read ON public.boutique_rayon FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS boutique_famille_read ON public.boutique_famille;
CREATE POLICY boutique_famille_read ON public.boutique_famille FOR SELECT USING (TRUE);

-- La composition d'un rayon se décide au bureau, pas depuis l'application :
-- aucune politique d'écriture. Les insertions passent par le service role.

GRANT EXECUTE ON FUNCTION public.famille_p(INTEGER)                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.famille_porteurs_requis(INTEGER)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.famille_couverture(INTEGER, INTEGER)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_rayon(UUID)                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prix_affiche(UUID, NUMERIC)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prix_client_relaye(UUID, NUMERIC, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rayon_etat(UUID)                          TO authenticated;
