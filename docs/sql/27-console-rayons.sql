-- ════════════════════════════════════════════════════════════════════════════
--  LA CONSOLE DES RAYONS — côté super admin
--
--  Jusqu'ici la composition d'un rayon se faisait à la main, en SQL. C'était
--  tenable pour un rayon ; ça ne l'est plus à partir du deuxième, et l'équipe
--  terrain n'écrit pas de requêtes.
--
--  Sept fonctions, toutes réservées au super admin. Aucune politique d'écriture
--  n'est ouverte sur les tables : c'est le seul chemin, et il passe par ici.
--
--  Une règle de sécurité qui n'a l'air de rien : `retirer` ne supprime pas la
--  ligne, il la désactive et l'horodate. Une boutique sortie d'un rayon garde
--  ses relais, ses compteurs et son historique — sans quoi l'arbitrage des
--  autres boutiques changerait rétroactivement.
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
       AND p.proname IN ('admin_rayons', 'admin_rayon_carte', 'admin_familles',
                         'admin_boutiques_libres', 'admin_affecter_boutique',
                         'admin_retirer_boutique', 'admin_creer_rayon',
                         'admin_maj_famille', 'admin_maj_rayon')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LIRE
-- ════════════════════════════════════════════════════════════════════════════

-- La liste des rayons, avec de quoi juger d'un coup d'œil s'ils tiennent debout.
CREATE OR REPLACE FUNCTION public.admin_rayons()
RETURNS TABLE (
  id UUID, nom TEXT, zone TEXT, ville TEXT, statut TEXT,
  perimetre_m INTEGER, min_boutiques INTEGER, max_boutiques INTEGER,
  plancher_recus INTEGER, ouvert_le DATE,
  boutiques INTEGER, familles INTEGER, familles_ouvertes INTEGER,
  couverture NUMERIC, prete BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;
  RETURN QUERY
  SELECT r.id, r.nom, r.zone, r.ville, r.statut,
         r.perimetre_m, r.min_boutiques, r.max_boutiques, r.plancher_recus, r.ouvert_le,
         (SELECT COUNT(*)::INTEGER FROM public.boutique_rayon br
           WHERE br.rayon_id = r.id AND br.actif),
         (SELECT COUNT(*)::INTEGER FROM public.familles f WHERE f.rayon_id = r.id),
         (SELECT COUNT(*)::INTEGER FROM public.familles f WHERE f.rayon_id = r.id AND f.ouverte),
         -- La couverture du rayon est celle de sa famille motrice : c'est elle
         -- qui commande, et une moyenne masquerait qu'elle est en dessous.
         (SELECT MIN(f.couverture) FROM public.familles f
           WHERE f.rayon_id = r.id AND f.role = 'moteur'),
         -- Prêt à ouvrir : toutes les familles motrices ont leurs porteurs, et
         -- le plancher de huit boutiques est atteint.
         (SELECT COUNT(*) FROM public.familles f
           WHERE f.rayon_id = r.id AND f.role = 'moteur' AND NOT f.ouverte) = 0
         AND (SELECT COUNT(*) FROM public.boutique_rayon br
               WHERE br.rayon_id = r.id AND br.actif) >= r.min_boutiques
    FROM public.rayons r
   ORDER BY r.ville, r.zone, r.nom;
END
$$;

-- Les boutiques d'un rayon, avec leur position : c'est ce qui matérialise le
-- rayon sur une carte. Une boutique sans position ne peut pas recevoir de
-- client relayé — le chemin ne se trace pas.
CREATE OR REPLACE FUNCTION public.admin_rayon_carte(p_rayon_id UUID)
RETURNS TABLE (
  vendor_id UUID, shop_name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  categorie TEXT, profil TEXT, genre TEXT, abonnement_fcfa INTEGER,
  familles TEXT, envoyes_30j INTEGER, recus_30j INTEGER, score INTEGER,
  distance_centre_m INTEGER, hors_perimetre BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; v_per INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  -- Le centre du rayon est le barycentre de ses boutiques : il n'y a pas de
  -- point fixe dans un marché, et c'est celui-là qui compte pour le périmètre.
  SELECT AVG(v.pickup_lat), AVG(v.pickup_lng) INTO v_lat, v_lng
    FROM public.boutique_rayon br JOIN public.vendors v ON v.id = br.vendor_id
   WHERE br.rayon_id = p_rayon_id AND br.actif AND v.pickup_lat IS NOT NULL;

  SELECT r.perimetre_m INTO v_per FROM public.rayons r WHERE r.id = p_rayon_id;

  RETURN QUERY
  SELECT v.id, v.shop_name, v.pickup_lat, v.pickup_lng,
         br.categorie, br.profil, br.genre, br.abonnement_fcfa,
         (SELECT string_agg(f.nom, ' · ' ORDER BY f.nom)
            FROM public.boutique_famille bf JOIN public.familles f ON f.id = bf.famille_id
           WHERE bf.vendor_id = v.id AND f.rayon_id = p_rayon_id),
         c.envoyes_30j, c.recus_30j, c.score,
         public.distance_m(v_lat, v_lng, v.pickup_lat, v.pickup_lng),
         COALESCE(public.distance_m(v_lat, v_lng, v.pickup_lat, v.pickup_lng), 0) > COALESCE(v_per, 500)
    FROM public.boutique_rayon br
    JOIN public.vendors v ON v.id = br.vendor_id
    CROSS JOIN LATERAL public.compteurs_boutique(v.id) c
   WHERE br.rayon_id = p_rayon_id AND br.actif
   ORDER BY c.score DESC;
END
$$;

-- Les sous-rayons : ce qui manque, famille par famille.
CREATE OR REPLACE FUNCTION public.admin_familles(p_rayon_id UUID)
RETURNS TABLE (
  id UUID, nom TEXT, role TEXT, variantes INTEGER, p NUMERIC,
  porteurs INTEGER, porteurs_requis INTEGER, manque INTEGER,
  couverture NUMERIC, ouverte BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;
  RETURN QUERY
  SELECT f.id, f.nom, f.role, f.variantes, ROUND(public.famille_p(f.variantes), 2),
         f.porteurs, f.porteurs_requis,
         GREATEST(0, f.porteurs_requis - f.porteurs),
         f.couverture, f.ouverte
    FROM public.familles f
   WHERE f.rayon_id = p_rayon_id
   ORDER BY (f.role = 'moteur') DESC, f.variantes DESC;
END
$$;

-- Les boutiques qui ne sont dans aucun rayon, pour les affecter.
CREATE OR REPLACE FUNCTION public.admin_boutiques_libres(p_recherche TEXT DEFAULT NULL)
RETURNS TABLE (
  vendor_id UUID, shop_name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  produits INTEGER, positionnee BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;
  RETURN QUERY
  SELECT v.id, v.shop_name, v.pickup_lat, v.pickup_lng,
         (SELECT COUNT(*)::INTEGER FROM public.products p WHERE p.vendor_id = v.id),
         v.pickup_lat IS NOT NULL
    FROM public.vendors v
   WHERE NOT EXISTS (SELECT 1 FROM public.boutique_rayon br
                      WHERE br.vendor_id = v.id AND br.actif)
     AND (p_recherche IS NULL OR v.shop_name ILIKE '%' || p_recherche || '%')
   ORDER BY v.shop_name
   LIMIT 100;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  2. ÉCRIRE
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_creer_rayon(
  p_nom TEXT, p_zone TEXT, p_ville TEXT DEFAULT 'Douala', p_perimetre INTEGER DEFAULT 500
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;
  INSERT INTO public.rayons (nom, zone, ville, perimetre_m, statut)
  VALUES (p_nom, p_zone, p_ville, p_perimetre, 'construction')
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_maj_rayon(
  p_rayon_id UUID, p_statut TEXT DEFAULT NULL,
  p_perimetre INTEGER DEFAULT NULL, p_plancher INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bloc INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  -- On refuse d'ouvrir un rayon dont une famille motrice n'a pas ses porteurs.
  -- Ce n'est pas de la prudence : avant ce seuil, un relais sur deux échoue, et
  -- un commerçant qui se plante deux fois n'utilise plus jamais le mécanisme.
  IF p_statut = 'actif' THEN
    SELECT COUNT(*) INTO v_bloc FROM public.familles f
     WHERE f.rayon_id = p_rayon_id AND f.role = 'moteur' AND NOT f.ouverte;
    IF v_bloc > 0 THEN
      RAISE EXCEPTION 'Impossible d''ouvrir : % famille(s) motrice(s) sous leur seuil de porteurs', v_bloc;
    END IF;
  END IF;

  UPDATE public.rayons
     SET statut         = COALESCE(p_statut, statut),
         perimetre_m    = COALESCE(p_perimetre, perimetre_m),
         plancher_recus = COALESCE(p_plancher, plancher_recus),
         ouvert_le      = CASE WHEN p_statut = 'actif' AND ouvert_le IS NULL
                               THEN CURRENT_DATE ELSE ouvert_le END
   WHERE id = p_rayon_id;
END
$$;

-- Créer ou modifier une famille. Le nombre de variantes est la seule donnée
-- saisie : tout le reste — p, porteurs requis, couverture — s'en déduit.
CREATE OR REPLACE FUNCTION public.admin_maj_famille(
  p_rayon_id UUID, p_nom TEXT, p_variantes INTEGER, p_role TEXT DEFAULT 'appoint',
  p_famille_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  IF p_famille_id IS NULL THEN
    INSERT INTO public.familles (rayon_id, nom, variantes, role)
    VALUES (p_rayon_id, p_nom, p_variantes, p_role)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.familles
       SET nom = p_nom, variantes = p_variantes, role = p_role
     WHERE id = p_famille_id
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.rafraichir_familles(p_rayon_id);
  RETURN v_id;
END
$$;

-- Affecter une boutique à un rayon, avec les familles qu'elle tient.
-- Une boutique ne peut appartenir qu'à un rayon actif à la fois : la fonction
-- retire l'ancien rattachement plutôt que d'échouer, parce que « changer de
-- rayon » est le geste courant et qu'il doit se faire en un clic.
CREATE OR REPLACE FUNCTION public.admin_affecter_boutique(
  p_vendor_id UUID, p_rayon_id UUID,
  p_categorie TEXT, p_profil TEXT DEFAULT 'emettrice',
  p_genre TEXT DEFAULT 'produit', p_abonnement INTEGER DEFAULT 15000,
  p_familles UUID[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ancien UUID;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  SELECT br.rayon_id INTO v_ancien
    FROM public.boutique_rayon br
   WHERE br.vendor_id = p_vendor_id AND br.actif AND br.rayon_id <> p_rayon_id
   LIMIT 1;

  IF v_ancien IS NOT NULL THEN
    UPDATE public.boutique_rayon SET actif = FALSE, sorti_le = NOW()
     WHERE vendor_id = p_vendor_id AND rayon_id = v_ancien;
    DELETE FROM public.boutique_famille bf
     USING public.familles f
     WHERE bf.famille_id = f.id AND bf.vendor_id = p_vendor_id AND f.rayon_id = v_ancien;
  END IF;

  INSERT INTO public.boutique_rayon (vendor_id, rayon_id, categorie, profil, genre, abonnement_fcfa, actif, sorti_le)
  VALUES (p_vendor_id, p_rayon_id, p_categorie, p_profil, p_genre, p_abonnement, TRUE, NULL)
  ON CONFLICT (vendor_id, rayon_id) DO UPDATE
    SET categorie = EXCLUDED.categorie, profil = EXCLUDED.profil,
        genre = EXCLUDED.genre, abonnement_fcfa = EXCLUDED.abonnement_fcfa,
        actif = TRUE, sorti_le = NULL;

  IF p_familles IS NOT NULL THEN
    DELETE FROM public.boutique_famille bf
     USING public.familles f
     WHERE bf.famille_id = f.id AND bf.vendor_id = p_vendor_id AND f.rayon_id = p_rayon_id;
    INSERT INTO public.boutique_famille (vendor_id, famille_id)
    SELECT p_vendor_id, unnest(p_familles)
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.rafraichir_familles(p_rayon_id);
  IF v_ancien IS NOT NULL THEN PERFORM public.rafraichir_familles(v_ancien); END IF;
END
$$;

-- Retirer : on désactive, on ne supprime pas. Les relais passés, les compteurs
-- et l'historique restent — sinon l'arbitrage des autres boutiques changerait
-- rétroactivement, et le score de chacun deviendrait faux.
CREATE OR REPLACE FUNCTION public.admin_retirer_boutique(p_vendor_id UUID, p_rayon_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  UPDATE public.boutique_rayon SET actif = FALSE, sorti_le = NOW()
   WHERE vendor_id = p_vendor_id AND rayon_id = p_rayon_id;

  DELETE FROM public.boutique_famille bf
   USING public.familles f
   WHERE bf.famille_id = f.id AND bf.vendor_id = p_vendor_id AND f.rayon_id = p_rayon_id;

  PERFORM public.rafraichir_familles(p_rayon_id);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_rayons()                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rayon_carte(UUID)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_familles(UUID)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_boutiques_libres(TEXT)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_creer_rayon(TEXT, TEXT, TEXT, INTEGER)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_maj_rayon(UUID, TEXT, INTEGER, INTEGER)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_maj_famille(UUID, TEXT, INTEGER, TEXT, UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_affecter_boutique(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retirer_boutique(UUID, UUID)                     TO authenticated;
