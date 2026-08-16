-- ════════════════════════════════════════════════════════════════════════════
--  LA RECHERCHE DU RAYON — montrer ce qui existe avant de demander
--
--  Le vendeur tape ce que son client cherche. Trois choses doivent s'afficher,
--  dans cet ordre, et l'ordre est tout :
--
--    1. CE QU'IL A, LUI. Il récupère les deux tiers des ruptures par sa propre
--       substitution, et c'est son métier. Une application qui propose le
--       voisin en premier lui prend des ventes, et il la désinstalle.
--
--    2. CE QUE LE RAYON A DÉJÀ RÉFÉRENCÉ. C'est la partie qui manquait : la
--       recherche trouvait ces articles et n'en montrait aucun — elle en
--       choisissait un en silence. Or le vendeur doit voir la fiche, la
--       boutique et le prix avant d'envoyer quelqu'un : c'est lui qui sait si
--       « Timberland noire 45 » est bien ce que son client veut.
--
--       Choisir un article ici lance un appel FERMÉ : celui qui reçoit voit une
--       fiche qu'il reconnaît et deux boutons. Deux secondes au lieu d'une
--       minute — et c'est le taux de réponse qui décide de la couverture.
--
--    3. RIEN NULLE PART. Alors seulement la question ouverte : on choisit la
--       famille, et celui qui répond oui saisit l'article et son prix net.
--       C'est ce cas-là qui construit le catalogue, il ne faut pas le fuir —
--       mais il ne faut pas y tomber quand une fiche existait déjà.
--
--  ET UNE ERREUR À CORRIGER
--
--  `chercher_dans_rayon` jointait `boutique_famille` sans regrouper : une
--  boutique qui tient quatre familles renvoyait quatre fois chacun de ses
--  articles. Le DISTINCT ON règle ça.
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
       AND p.proname IN ('chercher_dans_rayon', 'familles_du_rayon')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. CHERCHER
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.chercher_dans_rayon(p_vendor_id UUID, p_texte TEXT)
RETURNS TABLE (
  source      TEXT,          -- 'moi' passe toujours avant 'rayon'
  product_id  UUID,
  nom         TEXT,
  img         TEXT,
  vendor_id   UUID,
  shop_name   TEXT,
  prix_net    INTEGER,
  stock       TEXT,
  famille_id  UUID,
  famille     TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rayon UUID;
BEGIN
  v_rayon := public.vendor_rayon(p_vendor_id);
  IF v_rayon IS NULL THEN RETURN; END IF;

  RETURN QUERY
  -- Une ligne par article, pas une par famille de la boutique. Sans le
  -- DISTINCT ON, une boutique qui tient quatre familles renvoyait quatre fois
  -- chacun de ses articles.
  SELECT DISTINCT ON (p.id)
         CASE WHEN p.vendor_id = p_vendor_id THEN 'moi' ELSE 'rayon' END,
         p.id, p.name, p.img, p.vendor_id, v.shop_name, p.price::INTEGER, p.status,
         f.id, f.nom
    FROM public.products p
    JOIN public.vendors v         ON v.id = p.vendor_id
    JOIN public.boutique_rayon br ON br.vendor_id = p.vendor_id
                                 AND br.rayon_id  = v_rayon
                                 AND br.actif
    -- La famille de cette boutique la plus proche de l'article. Elle sert à
    -- élargir l'appel si l'article exact n'est plus là chez elle.
    LEFT JOIN LATERAL (
      SELECT fa.id, fa.nom
        FROM public.boutique_famille bf
        JOIN public.familles fa ON fa.id = bf.famille_id
       WHERE bf.vendor_id = p.vendor_id
         AND fa.rayon_id = v_rayon
         AND fa.ouverte
       ORDER BY fa.variantes DESC
       LIMIT 1
    ) f ON TRUE
   WHERE p.name ILIKE '%' || p_texte || '%'
   ORDER BY p.id, (p.vendor_id = p_vendor_id) DESC;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  2. LES FAMILLES OUVERTES DU RAYON
--
--  Pour la question ouverte : quand rien n'est référencé nulle part, le vendeur
--  choisit la famille et l'appel part vers ceux qui la portent. Les familles
--  fermées ne sont pas proposées — une famille sous son seuil de porteurs
--  produit des relais ratés, et un relais raté coûte plus cher qu'un client
--  qu'on n'a pas su servir.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.familles_du_rayon(p_vendor_id UUID)
RETURNS TABLE (id UUID, nom TEXT, porteurs INTEGER, couverture NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rayon UUID;
BEGIN
  v_rayon := public.vendor_rayon(p_vendor_id);
  IF v_rayon IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT f.id, f.nom, f.porteurs, f.couverture
    FROM public.familles f
   WHERE f.rayon_id = v_rayon AND f.ouverte
   ORDER BY (f.role = 'moteur') DESC, f.variantes DESC;
END
$$;

GRANT EXECUTE ON FUNCTION public.chercher_dans_rayon(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.familles_du_rayon(UUID)         TO authenticated;
