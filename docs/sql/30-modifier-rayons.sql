-- ════════════════════════════════════════════════════════════════════════════
--  MODIFIER UN RAYON ET SES SOUS-RAYONS
--
--  La console savait créer, pas corriger. Or la première saisie est toujours
--  fausse quelque part : un nom mal orthographié, un périmètre trop large, un
--  nombre de variantes posé de mémoire avant le comptage sur le terrain.
--
--  Le nombre de variantes est le cas important. C'est la seule donnée saisie
--  du modèle : tout le reste — la chance qu'un voisin ait l'équivalent, les
--  porteurs nécessaires, la couverture, l'ouverture de la famille — s'en
--  déduit. Le corriger après le comptage réel doit donc recalculer le rayon
--  entier, et c'est ce que fait `admin_maj_famille` en appelant
--  `rafraichir_familles` derrière elle.
--
--  Supprimer une famille est un geste rare et lourd : il retire d'un coup le
--  rattachement de toutes les boutiques qui la tenaient. La fonction le dit en
--  renvoyant le nombre de liens supprimés, pour que l'écran puisse le montrer
--  avant plutôt que de le découvrir après.
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
       AND p.proname IN ('admin_maj_rayon', 'admin_supprimer_famille',
                         'admin_supprimer_rayon')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. MODIFIER LE RAYON
--
--  Tous les champs sont facultatifs : on n'envoie que ce qui change.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_maj_rayon(
  p_rayon_id  UUID,
  p_statut    TEXT    DEFAULT NULL,
  p_perimetre INTEGER DEFAULT NULL,
  p_plancher  INTEGER DEFAULT NULL,
  p_nom       TEXT    DEFAULT NULL,
  p_zone      TEXT    DEFAULT NULL,
  p_ville     TEXT    DEFAULT NULL,
  p_min       INTEGER DEFAULT NULL,
  p_max       INTEGER DEFAULT NULL
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
     SET nom            = COALESCE(NULLIF(p_nom, ''),   nom),
         zone           = COALESCE(NULLIF(p_zone, ''),  zone),
         ville          = COALESCE(NULLIF(p_ville, ''), ville),
         statut         = COALESCE(p_statut, statut),
         perimetre_m    = COALESCE(p_perimetre, perimetre_m),
         plancher_recus = COALESCE(p_plancher, plancher_recus),
         min_boutiques  = COALESCE(p_min, min_boutiques),
         max_boutiques  = COALESCE(p_max, max_boutiques),
         ouvert_le      = CASE WHEN p_statut = 'actif' AND ouvert_le IS NULL
                               THEN CURRENT_DATE ELSE ouvert_le END
   WHERE id = p_rayon_id;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  2. SUPPRIMER UNE FAMILLE
--
--  Renvoie le nombre de boutiques qui la tenaient, pour que l'écran puisse
--  prévenir avant. Une famille supprimée par erreur, c'est une couverture qui
--  disparaît sans que personne ne comprenne pourquoi.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_supprimer_famille(p_famille_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rayon UUID; v_n INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  SELECT rayon_id INTO v_rayon FROM public.familles WHERE id = p_famille_id;
  IF v_rayon IS NULL THEN RAISE EXCEPTION 'Famille introuvable'; END IF;

  SELECT COUNT(*)::INTEGER INTO v_n
    FROM public.boutique_famille WHERE famille_id = p_famille_id;

  DELETE FROM public.familles WHERE id = p_famille_id;   -- boutique_famille suit en cascade
  PERFORM public.rafraichir_familles(v_rayon);
  RETURN v_n;
END
$$;

-- ════════════════════════════════════════════════════════════════════════════
--  3. SUPPRIMER UN RAYON
--
--  Seulement s'il est vide. Un rayon qui a des boutiques se vide d'abord, une
--  par une : la suppression en cascade emporterait aussi les relais et les
--  compteurs, et le score de chaque boutique deviendrait faux ailleurs.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_supprimer_rayon(p_rayon_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n INTEGER; v_r INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  SELECT COUNT(*) INTO v_n FROM public.boutique_rayon
   WHERE rayon_id = p_rayon_id AND actif;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Retire d''abord les % boutique(s) du rayon', v_n;
  END IF;

  SELECT COUNT(*) INTO v_r FROM public.relais WHERE rayon_id = p_rayon_id;
  IF v_r > 0 THEN
    RAISE EXCEPTION 'Ce rayon a % relais dans son histoire : suspends-le au lieu de le supprimer', v_r;
  END IF;

  DELETE FROM public.rayons WHERE id = p_rayon_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_maj_rayon(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_supprimer_famille(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_supprimer_rayon(UUID)   TO authenticated;
