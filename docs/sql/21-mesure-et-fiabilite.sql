-- ════════════════════════════════════════════════════════════════════════════
--  VOIR CE QUI SE PASSE : ENTONNOIR ET ERREURS
--
--  Jusqu'ici la plateforme ne savait rien d'elle-même. Combien de visiteurs
--  arrivent, combien créent un compte, combien mettent au panier, combien
--  commandent : aucune de ces questions n'avait de réponse. On pouvait donc
--  dépenser en acquisition sans jamais savoir si ça marchait — ce qui revient
--  à dépenser au hasard.
--
--  Et quand l'application plantait sur le téléphone d'un client, personne ne
--  l'apprenait. Le client partait, c'est tout.
--
--  Deux tables, donc :
--
--  1. `analytics_events` — ce que font les visiteurs, y compris ceux qui ne
--     sont pas connectés. Une session anonyme suffit à suivre un parcours.
--
--  2. `client_errors` — les plantages du navigateur, regroupés par empreinte :
--     mille fois la même erreur fait une ligne, pas mille.
--
--  Les deux s'écrivent par fonction, jamais en direct : on ne laisse pas un
--  navigateur insérer ce qu'il veut dans nos tables.
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
       AND p.proname IN ('track_event', 'log_client_error', 'funnel_stats',
                         'admin_client_errors', 'resolve_client_error',
                         'traffic_sources')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. CE QUE FONT LES VISITEURS
--
--  `session_id` est tiré par le navigateur et vit dans son stockage local.
--  Il ne dit pas qui est la personne — il dit que ces vingt clics sont la
--  même visite. C'est tout ce qu'il faut pour un entonnoir.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id         BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  path       TEXT,
  referrer   TEXT,
  -- D'où vient la visite : code partenaire, boutique qui a partagé son lien.
  source     TEXT,
  vendor_id  UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  props      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_time_idx    ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx    ON public.analytics_events(name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS analytics_events_source_idx  ON public.analytics_events(source, created_at DESC)
  WHERE source IS NOT NULL;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_read_admin ON public.analytics_events;
CREATE POLICY analytics_read_admin ON public.analytics_events
  FOR SELECT USING (public.is_super_admin());

COMMENT ON TABLE public.analytics_events IS
  'Parcours des visiteurs, connectés ou non. À purger périodiquement : '
  'un entonnoir se lit sur 90 jours, pas sur trois ans.';

-- ════════════════════════════════════════════════════════════════════════════
--  2. LES PLANTAGES DU NAVIGATEUR
--
--  Regroupés par empreinte : une erreur qui se répète mille fois donne une
--  ligne avec un compteur. Sinon la table devient illisible le jour où elle
--  devient utile.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.client_errors (
  fingerprint TEXT PRIMARY KEY,
  message     TEXT NOT NULL,
  stack       TEXT,
  path        TEXT,
  user_agent  TEXT,
  occurrences INTEGER NOT NULL DEFAULT 1,
  users_hit   INTEGER NOT NULL DEFAULT 1,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  last_user   UUID
);

CREATE INDEX IF NOT EXISTS client_errors_open_idx ON public.client_errors(last_seen DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_errors_read_admin ON public.client_errors;
CREATE POLICY client_errors_read_admin ON public.client_errors
  FOR SELECT USING (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  3. ENREGISTRER — la seule porte d'écriture
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.track_event(
  p_session   TEXT,
  p_name      TEXT,
  p_path      TEXT    DEFAULT NULL,
  p_referrer  TEXT    DEFAULT NULL,
  p_source    TEXT    DEFAULT NULL,
  p_vendor_id UUID    DEFAULT NULL,
  p_props     JSONB   DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Un nom d'événement vide ou une session absente ne servent à rien : on
  -- préfère ne rien écrire qu'écrire du bruit.
  IF COALESCE(TRIM(p_session), '') = '' OR COALESCE(TRIM(p_name), '') = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.analytics_events
    (session_id, user_id, name, path, referrer, source, vendor_id, props)
  VALUES (
    LEFT(TRIM(p_session), 64),
    auth.uid(),
    LEFT(TRIM(p_name), 64),
    LEFT(p_path, 300),
    LEFT(p_referrer, 300),
    LEFT(NULLIF(TRIM(COALESCE(p_source, '')), ''), 64),
    p_vendor_id,
    COALESCE(p_props, '{}'::JSONB)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_event(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_client_error(
  p_message TEXT,
  p_stack   TEXT DEFAULT NULL,
  p_path    TEXT DEFAULT NULL,
  p_ua      TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_fp TEXT; v_uid UUID;
BEGIN
  IF COALESCE(TRIM(p_message), '') = '' THEN RETURN; END IF;
  v_uid := auth.uid();

  -- L'empreinte ignore les numéros de ligne du bundle : ils changent à chaque
  -- déploiement alors que l'erreur, elle, est la même.
  v_fp := MD5(LEFT(TRIM(p_message), 300) || '|' || COALESCE(SPLIT_PART(p_path, '?', 1), ''));

  INSERT INTO public.client_errors (fingerprint, message, stack, path, user_agent, last_user)
  VALUES (v_fp, LEFT(TRIM(p_message), 500), LEFT(p_stack, 4000),
          LEFT(p_path, 300), LEFT(p_ua, 300), v_uid)
  ON CONFLICT (fingerprint) DO UPDATE SET
    occurrences = public.client_errors.occurrences + 1,
    users_hit   = public.client_errors.users_hit
                  + CASE WHEN v_uid IS NOT NULL
                          AND public.client_errors.last_user IS DISTINCT FROM v_uid
                         THEN 1 ELSE 0 END,
    last_seen   = NOW(),
    last_user   = COALESCE(v_uid, public.client_errors.last_user),
    stack       = COALESCE(public.client_errors.stack, LEFT(p_stack, 4000)),
    -- Une erreur qui revient après correction se rouvre toute seule.
    resolved_at = CASE WHEN public.client_errors.resolved_at IS NOT NULL
                        AND public.client_errors.resolved_at < NOW() - INTERVAL '1 hour'
                       THEN NULL ELSE public.client_errors.resolved_at END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_client_error(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. L'ENTONNOIR
--
--  Le haut vient des événements — c'est la seule source pour un visiteur qui
--  n'a pas de compte. Le bas vient des commandes, parce qu'une commande est
--  un fait, pas une mesure. Mélanger les deux est volontaire : on veut la
--  vérité en bas et l'ordre de grandeur en haut.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.funnel_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  visiteurs      INTEGER,
  inscrits       INTEGER,
  paniers        INTEGER,
  commandes      INTEGER,
  payees         INTEGER,
  livrees        INTEGER,
  gmv            BIGINT,
  panier_moyen   INTEGER,
  taux_panier    NUMERIC,
  taux_commande  NUMERIC,
  taux_livraison NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TIMESTAMPTZ;
  v_vis INT; v_ins INT; v_pan INT; v_cmd INT; v_pay INT; v_liv INT; v_gmv BIGINT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  v_from := NOW() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::INTERVAL;

  SELECT COUNT(DISTINCT e.session_id) INTO v_vis
  FROM public.analytics_events e
  WHERE e.created_at >= v_from AND e.name = 'page_view';

  SELECT COUNT(*) INTO v_ins FROM auth.users u WHERE u.created_at >= v_from;

  SELECT COUNT(DISTINCT e.session_id) INTO v_pan
  FROM public.analytics_events e
  WHERE e.created_at >= v_from AND e.name = 'add_to_cart';

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE o.status IN ('paid','confirmed','shipped','in_transit','delivered')),
         COUNT(*) FILTER (WHERE o.status = 'delivered'),
         COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'cancelled'), 0)
    INTO v_cmd, v_pay, v_liv, v_gmv
  FROM public.orders o WHERE o.created_at >= v_from;

  RETURN QUERY SELECT
    v_vis, v_ins, v_pan, v_cmd, v_pay, v_liv, v_gmv,
    CASE WHEN v_cmd > 0 THEN (v_gmv / v_cmd)::INT ELSE 0 END,
    CASE WHEN v_vis > 0 THEN ROUND(v_pan::NUMERIC * 100 / v_vis, 1) ELSE 0 END,
    CASE WHEN v_pan > 0 THEN ROUND(v_cmd::NUMERIC * 100 / v_pan, 1) ELSE 0 END,
    CASE WHEN v_cmd > 0 THEN ROUND(v_liv::NUMERIC * 100 / v_cmd, 1) ELSE 0 END;
END;
$$;

REVOKE ALL ON FUNCTION public.funnel_stats(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.funnel_stats(INTEGER) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. D'OÙ VIENNENT LES VISITES
--     Sans ça, impossible de savoir quelle boutique ou quel partenaire
--     amène vraiment du monde — donc impossible de récompenser le bon.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.traffic_sources(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  source      TEXT,
  shop_name   TEXT,
  visiteurs   INTEGER,
  inscrits    INTEGER,
  commandes   INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_from TIMESTAMPTZ;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  v_from := NOW() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::INTERVAL;

  -- L'attribution appartient à la SESSION, pas à l'événement. Le lien partagé
  -- par une boutique n'est cliqué qu'une fois, à l'arrivée ; la commande, elle,
  -- arrive dix clics plus tard sans rien porter. Attribuer événement par
  -- événement rangerait donc toutes les commandes en « direct », et la
  -- boutique qui a amené l'acheteur ne verrait jamais sa vente.
  --
  -- On retient la PREMIÈRE origine vue dans la session : c'est celle qui a
  -- fait venir la personne. Les suivantes ne font que la déplacer.
  RETURN QUERY
  WITH origine AS (
    SELECT DISTINCT ON (e.session_id)
           e.session_id, e.source, e.vendor_id
      FROM public.analytics_events e
     WHERE e.created_at >= v_from AND e.source IS NOT NULL
     ORDER BY e.session_id, e.created_at
  ), sessions AS (
    SELECT e.session_id,
           COALESCE(o.source, 'direct')                        AS src,
           o.vendor_id,
           MAX(e.user_id::TEXT)                                AS uid,
           BOOL_OR(e.name = 'order_placed')                    AS a_commande
      FROM public.analytics_events e
      LEFT JOIN origine o ON o.session_id = e.session_id
     WHERE e.created_at >= v_from
     GROUP BY e.session_id, o.source, o.vendor_id
  )
  SELECT s.src::TEXT,
         v.shop_name::TEXT,
         COUNT(*)::INT,
         COUNT(s.uid)::INT,
         COUNT(*) FILTER (WHERE s.a_commande)::INT
    FROM sessions s
    LEFT JOIN public.vendors v ON v.id = s.vendor_id
   GROUP BY 1, 2
   ORDER BY 3 DESC
   LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.traffic_sources(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.traffic_sources(INTEGER) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LES ERREURS, CÔTÉ ADMINISTRATION
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_client_errors(p_open_only BOOLEAN DEFAULT TRUE)
RETURNS SETOF public.client_errors
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN QUERY
  SELECT * FROM public.client_errors c
  WHERE NOT p_open_only OR c.resolved_at IS NULL
  ORDER BY c.last_seen DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_client_error(p_fingerprint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.client_errors c SET resolved_at = NOW() WHERE c.fingerprint = p_fingerprint;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_client_errors(BOOLEAN)  FROM anon;
REVOKE ALL ON FUNCTION public.resolve_client_error(TEXT)    FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_client_errors(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_client_error(TEXT)   TO authenticated;
