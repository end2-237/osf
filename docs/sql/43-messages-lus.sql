-- ════════════════════════════════════════════════════════════════════════════
--  43 — LES MESSAGES LUS
--
--  Le défaut : la pastille comptait les messages des SEPT DERNIERS JOURS, pas
--  les non lus. Deux messages hier, lus hier ; deux de plus demain, et la
--  pastille affiche quatre. Le commerçant rouvre l'écran, ne trouve rien de
--  neuf, et apprend en trois jours que la pastille ment.
--
--  C'est le pire état possible pour un compteur d'alerte. Une pastille juste
--  fait ouvrir l'écran ; une pastille absente ne coûte rien ; une pastille
--  qui ment fait ignorer TOUTES les suivantes, y compris celle qui annonce la
--  suspension de la boutique.
--
--  On marque donc la lecture, des deux côtés : l'historique des actions et la
--  file de notifications. Un seul geste — ouvrir l'écran — les couvre tous
--  les deux, parce que c'est un seul écran pour le commerçant et qu'il ne
--  saurait pas qu'il y en a deux.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

ALTER TABLE public.actions_admin
  ADD COLUMN IF NOT EXISTS lu_le TIMESTAMPTZ;

-- On ne cherche jamais les lus : l'index ne porte que sur ce qui reste à lire,
-- et il reste minuscule même après des années d'historique.
CREATE INDEX IF NOT EXISTS actions_admin_non_lus_idx
  ON public.actions_admin (vendor_id) WHERE lu_le IS NULL;

CREATE INDEX IF NOT EXISTS relais_notif_non_lues_idx
  ON public.relais_notifications (vendor_id) WHERE lue_le IS NULL;

-- ─── Le compteur ────────────────────────────────────────────────────────────
--  Les deux sources se recoupent : une action de l'administration écrit une
--  ligne d'historique ET une notification. Les additionner afficherait deux
--  pour un seul message. On ne compte donc que l'historique pour ce qui vient
--  de l'administration, et les notifications pour ce qui vient du relais.
CREATE OR REPLACE FUNCTION public.compter_messages_non_lus(p_vendor_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    SELECT count(*) FROM public.actions_admin a
     WHERE a.vendor_id = p_vendor_id AND a.lu_le IS NULL
  ) + (
    SELECT count(*) FROM public.relais_notifications n
     WHERE n.vendor_id = p_vendor_id AND n.lue_le IS NULL
       AND n.genre IN ('appel', 'arrive', 'vendu', 'pas_venu')
  );
$$;

-- ─── Le marquage ────────────────────────────────────────────────────────────
--  Rendu à la DEMANDE de l'écran, jamais dans une lecture. Marquer lu dans la
--  fonction qui liste paraîtrait économe et serait faux : le tableau de bord
--  charge le compteur en arrière-plan, sans que personne ait rien ouvert, et
--  tout serait effacé avant d'avoir été vu.
CREATE OR REPLACE FUNCTION public.marquer_messages_lus(p_vendor_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT := 0; m INT := 0;
BEGIN
  IF NOT (public.owns_vendor(p_vendor_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Ces messages ne sont pas les tiens.';
  END IF;

  UPDATE public.actions_admin
     SET lu_le = now()
   WHERE vendor_id = p_vendor_id AND lu_le IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.relais_notifications
     SET lue_le = now()
   WHERE vendor_id = p_vendor_id AND lue_le IS NULL;
  GET DIAGNOSTICS m = ROW_COUNT;

  RETURN n + m;
END $$;

-- ─── L'historique rend maintenant l'état de lecture ─────────────────────────
--  `CREATE OR REPLACE` ne sait pas changer un type de retour : il faut passer
--  par un DROP. D'où la précaution — sans le CASCADE explicite on hériterait
--  d'une erreur illisible si une vue s'y appuyait un jour.
DROP FUNCTION IF EXISTS public.mes_actions_admin(UUID, INT);

CREATE FUNCTION public.mes_actions_admin(p_vendor_id UUID, p_limite INT DEFAULT 50)
RETURNS TABLE (id UUID, genre TEXT, motif TEXT, message TEXT,
               cible TEXT, lu BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.genre, a.motif, a.message, a.cible,
         a.lu_le IS NOT NULL, a.created_at
  FROM public.actions_admin a
  WHERE a.vendor_id = p_vendor_id
    AND (public.owns_vendor(p_vendor_id) OR public.is_super_admin())
  ORDER BY a.created_at DESC
  LIMIT p_limite;
$$;

GRANT EXECUTE ON FUNCTION public.mes_actions_admin(UUID, INT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.compter_messages_non_lus(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.marquer_messages_lus(UUID)            TO authenticated;

-- ─── Ce qui existe déjà est considéré comme lu ──────────────────────────────
--  Sans ça, le premier commerçant qui ouvre l'écran après cette migration
--  reçoit une pastille avec tout son historique — y compris des messages
--  qu'il a déjà lus la semaine dernière. On repart de zéro : la lecture
--  commence à s'enregistrer aujourd'hui.
UPDATE public.actions_admin       SET lu_le  = now() WHERE lu_le  IS NULL;
UPDATE public.relais_notifications SET lue_le = now() WHERE lue_le IS NULL;

DO $$ BEGIN
  RAISE NOTICE 'La pastille compte désormais les NON LUS, plus les sept derniers jours.';
END $$;
