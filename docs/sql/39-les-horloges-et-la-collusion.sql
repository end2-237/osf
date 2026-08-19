/* ════════════════════════════════════════════════════════════════════════════
   39 — LES HORLOGES TOURNENT, ET LA COLLUSION SE VOIT

   Deux trous relevés à l'audit du document 5.

   LE PREMIER EST LE PLUS COÛTEUX. `expirer_relais` et `relais_a_confirmer`
   existaient depuis la migration 25, et rien ne les appelait jamais. Aucune
   tâche planifiée, aucun appel depuis l'application. Conséquences réelles :
   un relais attribué que le client ne va pas chercher reste `attribue` pour
   toujours au lieu d'expirer à 48 h — il bloque la boutique dans l'arbitrage
   et le bon reste réservé sans jamais être ni crédité ni libéré ; et un relais
   payé que personne ne confirme ne libère jamais l'argent du vendeur. La
   machine à états du chapitre 6 décrit des horloges ; il n'y en avait pas.

   LE SECOND EST LA SEULE FRAUDE QUE LA STRUCTURE NE BLOQUE PAS. Le chapitre 9
   la nomme : deux boutiques voisines qui s'arrangent hors application. Les
   données pour la voir étaient déjà écrites — `rang_propose`, `rang_choisi`,
   `motif_ecart` — mais aucune requête ne les lisait. Trois compteurs, trois
   seuils, et aucune sanction automatique : ils déclenchent une visite, pas une
   exclusion. Dans un marché de cinq cents mètres, punir sans avoir vu coûte
   plus cher que la fraude.
   ════════════════════════════════════════════════════════════════════════════ */

SET lock_timeout = '5s';

/* ── 1. UN SEUL BATTEMENT ────────────────────────────────────────────────────
   Une fonction qui fait tourner toutes les horloges du relais et rend compte.
   Un seul point d'entrée : c'est plus simple à planifier, et plus simple à
   déclencher à la main le jour où la planification tombe.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.battement_relais()
RETURNS TABLE (expires INTEGER, confirmes INTEGER, presences_purgees INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exp INTEGER := 0; v_conf INTEGER := 0; v_pres INTEGER := 0;
BEGIN
  -- 48 h sans arrivée : le relais meurt, aucun bon n'est crédité. L'envoyeur
  -- a fait son travail — c'est le client qui a changé d'avis.
  SELECT public.expirer_relais() INTO v_exp;

  -- Payé depuis plus de deux heures sans confirmation. Le client est reparti
  -- avec son article ; le commerçant ne peut pas rester bloqué parce que
  -- quelqu'un a oublié d'appuyer sur un bouton.
  SELECT public.relais_a_confirmer() INTO v_conf;

  -- Les présences de comptoir vivent quinze minutes. Celles d'hier ne servent
  -- plus qu'à encombrer la liste du vendeur.
  UPDATE public.presences_comptoir
     SET utilisee = TRUE
   WHERE NOT utilisee AND expire_le < NOW();
  GET DIAGNOSTICS v_pres = ROW_COUNT;

  RETURN QUERY SELECT v_exp, v_conf, v_pres;
END $$;

REVOKE ALL ON FUNCTION public.battement_relais() FROM anon, authenticated;

/* ── 2. LA PLANIFICATION ─────────────────────────────────────────────────────
   pg_cron vit dans le schéma `extensions` chez Supabase. Si l'extension n'est
   pas disponible, le bloc échoue proprement et le fichier continue : les
   fonctions restent appelables à la main, et le message dit quoi faire.
   ──────────────────────────────────────────────────────────────────────────── */

DO $cron$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponible (%). Active-le dans Supabase → Database → Extensions, puis rejoue ce fichier.', SQLERRM;
    RETURN;
  END;

  -- Rejouable : on supprime avant de poser.
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'battement_relais';

  -- Toutes les cinq minutes. Les deux horloges se comptent en heures : une
  -- précision à la minute ne servirait à rien et réveillerait la base 1 440
  -- fois par jour pour rien.
  PERFORM cron.schedule('battement_relais', '*/5 * * * *',
                        $j$SELECT public.battement_relais();$j$);

  RAISE NOTICE 'Horloges planifiées : battement_relais toutes les 5 minutes.';
END
$cron$;

/* ── 3. POUSSER LES NOTIFICATIONS EN DEHORS DE L'APPLICATION ──────────────────
   `relais-notify` n'est appelée que par l'application, juste après un appel à
   disponibilité. Tout ce qui n'est pas un appel — la vente confirmée, le bon
   expiré, le relais qui arrive — n'est donc jamais poussé : la file se remplit
   et personne ne la vide.

   La tâche a besoin de l'adresse du projet et de la clé anon. Ni l'une ni
   l'autre n'est un secret : la clé anon est déjà dans le bundle du navigateur.
   Mais elles ne sont pas dans ce fichier, parce qu'un dépôt n'est pas un
   endroit où écrire une configuration d'environnement. On les range dans une
   table, et la tâche les y lit.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.reglages_taches (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);
ALTER TABLE public.reglages_taches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reglages_admin ON public.reglages_taches;
CREATE POLICY reglages_admin ON public.reglages_taches
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.pousser_notifications_relais()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_url TEXT; v_cle TEXT;
BEGIN
  SELECT valeur INTO v_url FROM public.reglages_taches WHERE cle = 'supabase_url';
  SELECT valeur INTO v_cle FROM public.reglages_taches WHERE cle = 'anon_key';
  IF v_url IS NULL OR v_cle IS NULL THEN
    RETURN 'Réglages absents — voir les deux INSERT en fin de fichier.';
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/relais-notify',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_cle,
                                  'apikey', v_cle),
    body    := '{}'::jsonb
  );
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.pousser_notifications_relais() FROM anon, authenticated;

DO $notif$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net indisponible (%). Les notifications hors appel resteront à pousser depuis l''application.', SQLERRM;
    RETURN;
  END;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'notifications_relais';
  PERFORM cron.schedule('notifications_relais', '* * * * *',
                        $j$SELECT public.pousser_notifications_relais();$j$);
  RAISE NOTICE 'Notifications planifiées : chaque minute.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification des notifications impossible : %', SQLERRM;
END
$notif$;

/* ── 4. LES TROIS COMPTEURS DE COLLUSION ─────────────────────────────────────
   Chapitre 9 du document 5, à la lettre.

     · la part des relais d'une boutique qui partent vers une même autre —
       au-delà de 40 %, on regarde ;
     · la part des relais qui s'écartent du classement de l'arbitrage —
       au-delà de 50 %, on visite ;
     · le taux de transformation d'une boutique réceptrice — anormalement
       haut, il signale des clients qui venaient de toute façon.

   Aucun ne déclenche de sanction. Ils rangent les boutiques par ordre de
   ce qu'il y a à aller voir.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.compteurs_collusion(
  p_rayon_id UUID DEFAULT NULL, p_jours INTEGER DEFAULT 30
)
RETURNS TABLE (
  vendor_id        UUID,
  shop_name        TEXT,
  envoyes          INTEGER,
  vers_la_meme     INTEGER,     -- vers la boutique la plus servie
  meme_boutique    TEXT,
  part_concentree  NUMERIC,     -- vers_la_meme / envoyes
  hors_classement  INTEGER,
  part_hors_rang   NUMERIC,
  recus            INTEGER,
  transformes      INTEGER,
  taux_transfo     NUMERIC,
  a_regarder       BOOLEAN,     -- concentration > 40 %
  a_visiter        BOOLEAN      -- écarts > 50 %
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT r.*
      FROM public.relais r
     WHERE r.created_at > NOW() - (p_jours || ' days')::INTERVAL
       AND (p_rayon_id IS NULL OR r.rayon_id = p_rayon_id)
  ),
  -- Ce que chaque boutique a envoyé, et vers qui.
  envois AS (
    SELECT emetteur_id AS vid,
           COUNT(*)::INTEGER AS env,
           COUNT(*) FILTER (WHERE COALESCE(rang_choisi, 1) > 1)::INTEGER AS hors
      FROM base GROUP BY emetteur_id
  ),
  -- La destination la plus servie par chaque émetteur : c'est elle qui
  -- révèle un couple, pas la moyenne.
  couple AS (
    SELECT DISTINCT ON (emetteur_id)
           emetteur_id AS vid, receveur_id, COUNT(*)::INTEGER AS n
      FROM base GROUP BY emetteur_id, receveur_id
     ORDER BY emetteur_id, COUNT(*) DESC
  ),
  -- Ce que chaque boutique a reçu, et ce qu'elle en a transformé en vente.
  recus AS (
    SELECT receveur_id AS vid,
           COUNT(*)::INTEGER AS rec,
           COUNT(*) FILTER (WHERE etat = 'remis')::INTEGER AS ok
      FROM base
     WHERE etat IN ('attribue','arrive','paye','remis','annule','expire')
     GROUP BY receveur_id
  )
  SELECT v.id, v.shop_name,
         COALESCE(e.env, 0),
         COALESCE(c.n, 0),
         cv.shop_name,
         CASE WHEN COALESCE(e.env, 0) = 0 THEN 0
              ELSE ROUND(c.n::NUMERIC / e.env, 2) END,
         COALESCE(e.hors, 0),
         CASE WHEN COALESCE(e.env, 0) = 0 THEN 0
              ELSE ROUND(e.hors::NUMERIC / e.env, 2) END,
         COALESCE(rc.rec, 0),
         COALESCE(rc.ok, 0),
         CASE WHEN COALESCE(rc.rec, 0) = 0 THEN 0
              ELSE ROUND(rc.ok::NUMERIC / rc.rec, 2) END,
         -- Les seuils ne mordent qu'à partir de cinq envois : sur trois
         -- relais, « 67 % vers la même boutique » ne veut rien dire.
         COALESCE(e.env, 0) >= 5 AND COALESCE(c.n, 0)::NUMERIC / NULLIF(e.env, 0) > 0.40,
         COALESCE(e.env, 0) >= 5 AND COALESCE(e.hors, 0)::NUMERIC / NULLIF(e.env, 0) > 0.50
    FROM public.vendors v
    LEFT JOIN envois e  ON e.vid = v.id
    LEFT JOIN couple c  ON c.vid = v.id
    LEFT JOIN public.vendors cv ON cv.id = c.receveur_id
    LEFT JOIN recus  rc ON rc.vid = v.id
   WHERE COALESCE(e.env, 0) > 0 OR COALESCE(rc.rec, 0) > 0
   ORDER BY
     (COALESCE(e.env, 0) >= 5 AND COALESCE(e.hors, 0)::NUMERIC / NULLIF(e.env, 0) > 0.50) DESC,
     (COALESCE(e.env, 0) >= 5 AND COALESCE(c.n, 0)::NUMERIC / NULLIF(e.env, 0) > 0.40) DESC,
     COALESCE(e.env, 0) DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.compteurs_collusion(UUID, INTEGER) TO authenticated;

/* ════════════════════════════════════════════════════════════════════════════
   À FAIRE UNE FOIS, À LA MAIN

   Remplace les deux valeurs par celles de ton projet — ce sont exactement
   VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY, déjà publiques toutes les deux.
   Sans ça, seules les horloges tournent ; les notifications hors appel
   resteront en file.

     INSERT INTO public.reglages_taches (cle, valeur) VALUES
       ('supabase_url', 'https://xxxxxxxx.supabase.co'),
       ('anon_key',     'eyJ...')
     ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur;

   VÉRIFICATION

     SELECT jobname, schedule, active FROM cron.job;
     SELECT * FROM public.battement_relais();
   ════════════════════════════════════════════════════════════════════════════ */
