-- ════════════════════════════════════════════════════════════════════════════
--  LE RETRAIT LAISSE UNE TRACE, ET SE CONTESTE
--
--  Jusqu'ici un versement validé par l'administration ne produisait rien : le
--  vendeur voyait « Versé » dans un tableau, sans pièce à garder, et sans
--  aucun recours si l'argent n'arrivait jamais sur son mobile money. Le seul
--  moyen de le dire était d'écrire à quelqu'un.
--
--  Ce fichier pose les deux moitiés manquantes :
--
--  1. UN REÇU. Chaque versement effectué donne droit à un reçu numéroté, émis
--     par le service de facturation, téléchargeable autant de fois qu'on veut.
--     C'est la pièce que le vendeur classe.
--
--  2. UNE CONTESTATION. Le vendeur déclare lui-même « je n'ai pas reçu ce
--     virement », avec un motif. Le versement passe en litige : il reste
--     décompté de son solde tant que ce n'est pas tranché — sans quoi il
--     suffirait de contester pour redemander la même somme. L'administration
--     arbitre avec la référence de la transaction en main :
--
--       · versement confirmé  → le virement est bien parti, retour à « versé » ;
--       · versement recrédité → on reconnaît qu'il n'est pas arrivé, la somme
--         retourne au solde disponible et le vendeur peut redemander.
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
       AND p.proname IN ('vendor_balance', 'admin_payouts', 'process_payout',
                         'dispute_payout', 'resolve_payout_dispute',
                         'admin_payout_disputes', 'my_payouts')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. DEUX ÉTATS DE PLUS POUR UN VERSEMENT
--
--  « en litige » : le vendeur dit ne pas l'avoir reçu, l'administration
--  n'a pas encore tranché. « recrédité » : on a reconnu que l'argent n'était
--  pas arrivé, la somme est rendue au solde.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendor_payouts DROP CONSTRAINT IF EXISTS vendor_payouts_status_check;
ALTER TABLE public.vendor_payouts ADD CONSTRAINT vendor_payouts_status_check
  CHECK (status IN ('pending', 'processing', 'paid', 'rejected', 'disputed', 'reimbursed'));

ALTER TABLE public.vendor_payouts
  ADD COLUMN IF NOT EXISTS disputed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason      TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_outcome     TEXT
    CHECK (dispute_outcome IS NULL OR dispute_outcome IN ('confirmed', 'reimbursed')),
  ADD COLUMN IF NOT EXISTS dispute_note        TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id          UUID,
  ADD COLUMN IF NOT EXISTS invoice_number      TEXT,
  ADD COLUMN IF NOT EXISTS invoice_url         TEXT;

COMMENT ON COLUMN public.vendor_payouts.dispute_outcome IS
  'confirmed : le virement est bien parti, le vendeur reste débité. '
  'reimbursed : il n''est pas arrivé, la somme retourne au solde disponible.';

-- Combien de temps un versement reste contestable. Passé ce délai, un compte
-- mobile money a forcément été crédité ou pas : rouvrir des mois après ne
-- prouverait plus rien.
ALTER TABLE public.platform_policy
  ADD COLUMN IF NOT EXISTS payout_dispute_days INTEGER NOT NULL DEFAULT 15;

INSERT INTO public.platform_policy (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
--  2. LE SOLDE — un litige ne rend pas l'argent
--
--  Seule ligne changée par rapport au fichier 15 : `withdrawn` compte aussi
--  les versements en litige. Contester ne doit pas remettre la somme à
--  disposition, sinon il suffirait de contester pour la demander deux fois.
--  Elle ne revient qu'une fois le litige tranché en faveur du vendeur.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.vendor_balance(p_vendor_id UUID)
RETURNS TABLE (collected BIGINT, withdrawn BIGINT, pending BIGINT,
               available BIGINT, held BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collected BIGINT; v_withdrawn BIGINT; v_pending BIGINT;
  v_held BIGINT; v_mode TEXT; v_hold INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(delivery_mode, 'self') INTO v_mode
  FROM public.vendors WHERE id = p_vendor_id;
  SELECT pp.funds_hold_hours INTO v_hold FROM public.platform_policy pp WHERE pp.id;

  WITH dus AS (
    SELECT o.id,
           o.total_amount
             + CASE WHEN v_mode = 'self' THEN COALESCE(o.delivery_fee, 0) ELSE 0 END
             AS montant,
           (o.payment_method IN ('orange_money', 'mtn_momo')
            OR v_mode = 'buyticle') AS encaisse_par_nous,
           o.status, o.return_status, o.delivered_at,
           o.funds_released_at, o.client_confirmed_at
    FROM public.orders o
    WHERE o.vendor_id = p_vendor_id
  ), etats AS (
    SELECT montant,
           CASE
             WHEN NOT encaisse_par_nous              THEN 'hors'
             WHEN status <> 'delivered'              THEN 'attente'
             WHEN return_status IN ('requested', 'approved', 'returned') THEN 'gele'
             WHEN funds_released_at IS NOT NULL
               OR client_confirmed_at IS NOT NULL    THEN 'libere'
             WHEN delivered_at IS NOT NULL
              AND delivered_at + (v_hold || ' hours')::INTERVAL <= NOW()
                                                     THEN 'libere'
             ELSE 'retenu'
           END AS etat
    FROM dus
  )
  SELECT COALESCE(SUM(montant) FILTER (WHERE etat = 'libere'), 0),
         COALESCE(SUM(montant) FILTER (WHERE etat IN ('retenu', 'gele')), 0)
    INTO v_collected, v_held
  FROM etats;

  -- Sorti, ou contesté mais pas encore tranché : indisponible dans les deux cas.
  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status IN ('paid', 'disputed');

  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status IN ('pending', 'processing');

  RETURN QUERY SELECT v_collected, v_withdrawn, v_pending,
                      GREATEST(v_collected - v_withdrawn - v_pending, 0),
                      v_held;
END;
$$;

COMMENT ON FUNCTION public.vendor_balance(UUID) IS
  'Ne compte que l''argent libéré : commande livrée, puis confirmée par le '
  'client ou fenêtre de rétention écoulée sans litige. Un versement contesté '
  'reste décompté tant que le litige n''est pas tranché. Aucune commission.';

REVOKE ALL ON FUNCTION public.vendor_balance(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_balance(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  3. « JE N'AI PAS REÇU CE VIREMENT »
--
--  Le vendeur seul peut le dire, et seulement d'un versement marqué payé.
--  Le motif est obligatoire : « rien reçu » sans plus n'aide personne à
--  chercher, et l'administration arbitre sur ce que le vendeur écrit.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.dispute_payout(
  p_payout_id UUID,
  p_reason    TEXT
)
RETURNS public.vendor_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.vendor_payouts; v_days INTEGER; v_ref TEXT;
BEGIN
  SELECT * INTO v_row FROM public.vendor_payouts p WHERE p.id = p_payout_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versement introuvable'; END IF;

  IF NOT public.owns_vendor(v_row.vendor_id) THEN
    RAISE EXCEPTION 'Ce versement n''est pas le vôtre';
  END IF;

  IF v_row.status = 'disputed' THEN
    RAISE EXCEPTION 'Ce versement est déjà en litige, l''équipe Buyticle l''examine.';
  END IF;
  IF v_row.status <> 'paid' THEN
    RAISE EXCEPTION 'Seul un versement marqué comme effectué peut être contesté (celui-ci est : %).', v_row.status;
  END IF;

  SELECT pp.payout_dispute_days INTO v_days FROM public.platform_policy pp WHERE pp.id;
  v_days := COALESCE(v_days, 15);

  IF COALESCE(v_row.processed_at, v_row.requested_at) + (v_days || ' days')::INTERVAL < NOW() THEN
    RAISE EXCEPTION 'Le délai de contestation de % jours est passé pour ce versement.', v_days;
  END IF;

  IF COALESCE(LENGTH(TRIM(p_reason)), 0) < 10 THEN
    RAISE EXCEPTION 'Explique en quelques mots ce qui s''est passé : c''est là-dessus que nous cherchons.';
  END IF;

  UPDATE public.vendor_payouts p
     SET status         = 'disputed',
         disputed_at    = NOW(),
         dispute_reason = TRIM(p_reason),
         dispute_resolved_at = NULL,
         dispute_outcome     = NULL
   WHERE p.id = p_payout_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.dispute_payout(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.dispute_payout(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  4. L'ARBITRAGE
--
--  Deux issues seulement, parce qu'il n'y en a pas d'autres : soit le virement
--  est parti et la référence le prouve, soit il n'est pas arrivé et on rend
--  l'argent. Un « on verra » laisserait le solde du vendeur faux.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_payout_dispute(
  p_payout_id UUID,
  p_outcome   TEXT,
  p_note      TEXT DEFAULT NULL
)
RETURNS public.vendor_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.vendor_payouts;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF p_outcome NOT IN ('confirmed', 'reimbursed') THEN
    RAISE EXCEPTION 'Issue inconnue : attendu « confirmed » ou « reimbursed »';
  END IF;

  SELECT * INTO v_row FROM public.vendor_payouts p WHERE p.id = p_payout_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versement introuvable'; END IF;
  IF v_row.status <> 'disputed' THEN
    RAISE EXCEPTION 'Ce versement n''est pas en litige (%)', v_row.status;
  END IF;

  UPDATE public.vendor_payouts p
     SET status              = CASE WHEN p_outcome = 'confirmed' THEN 'paid' ELSE 'reimbursed' END,
         dispute_outcome     = p_outcome,
         dispute_note        = NULLIF(TRIM(COALESCE(p_note, '')), ''),
         dispute_resolved_at = NOW()
   WHERE p.id = p_payout_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_payout_dispute(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_payout_dispute(UUID, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. CE QUE VOIT L'ADMINISTRATION
--
--  Les colonnes de litige rejoignent la liste existante, et une seconde
--  fonction ne rapporte que les litiges — avec les deux faits qui servent à
--  décider : combien ce vendeur en a déjà ouverts, et combien se sont révélés
--  infondés. Un vendeur qui conteste tous ses versements n'est pas dans la
--  même situation que celui qui le fait pour la première fois.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_payouts(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, vendor_id UUID, shop_name TEXT, vendor_email TEXT,
  amount INTEGER, method TEXT, phone TEXT, status TEXT,
  note TEXT, reference TEXT,
  requested_at TIMESTAMPTZ, processed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ, dispute_reason TEXT,
  dispute_outcome TEXT, dispute_note TEXT, dispute_resolved_at TIMESTAMPTZ,
  invoice_number TEXT, invoice_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT p.id, p.vendor_id, v.shop_name, v.email,
         p.amount, p.method, p.phone, p.status,
         p.note, p.reference, p.requested_at, p.processed_at,
         p.disputed_at, p.dispute_reason,
         p.dispute_outcome, p.dispute_note, p.dispute_resolved_at,
         p.invoice_number, p.invoice_url
  FROM public.vendor_payouts p
  JOIN public.vendors v ON v.id = p.vendor_id
  WHERE p_status IS NULL OR p.status = p_status
  ORDER BY
    CASE p.status
      WHEN 'disputed'   THEN 0
      WHEN 'pending'    THEN 1
      WHEN 'processing' THEN 2
      ELSE 3 END,
    p.requested_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_payout_disputes()
RETURNS TABLE (
  id UUID, vendor_id UUID, shop_name TEXT, vendor_email TEXT,
  amount INTEGER, method TEXT, phone TEXT,
  reference TEXT, requested_at TIMESTAMPTZ, processed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ, dispute_reason TEXT,
  invoice_number TEXT, invoice_url TEXT,
  vendor_disputes INTEGER, vendor_disputes_rejected INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT p.id, p.vendor_id, v.shop_name, v.email,
         p.amount, p.method, p.phone,
         p.reference, p.requested_at, p.processed_at,
         p.disputed_at, p.dispute_reason,
         p.invoice_number, p.invoice_url,
         (SELECT COUNT(*)::INT FROM public.vendor_payouts d
           WHERE d.vendor_id = p.vendor_id AND d.disputed_at IS NOT NULL),
         (SELECT COUNT(*)::INT FROM public.vendor_payouts d
           WHERE d.vendor_id = p.vendor_id AND d.dispute_outcome = 'confirmed')
  FROM public.vendor_payouts p
  JOIN public.vendors v ON v.id = p.vendor_id
  WHERE p.status = 'disputed'
  ORDER BY p.disputed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payouts(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.admin_payout_disputes() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_payouts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payout_disputes() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  6. LE TRAITEMENT, AVEC LES DEUX NOUVEAUX ÉTATS
--
--  Inchangé, sauf qu'un versement en litige ne se rouvre pas par ce chemin :
--  il se tranche par `resolve_payout_dispute`, qui est fait pour ça.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.process_payout(
  p_payout_id UUID,
  p_status    TEXT,
  p_reference TEXT DEFAULT NULL,
  p_note      TEXT DEFAULT NULL
)
RETURNS public.vendor_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_current TEXT; v_row public.vendor_payouts;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_status NOT IN ('pending', 'processing', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;

  SELECT p.status INTO v_current FROM public.vendor_payouts p WHERE p.id = p_payout_id;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Demande introuvable';
  END IF;
  IF v_current = 'disputed' THEN
    RAISE EXCEPTION 'Ce versement est en litige : tranche-le depuis l''onglet Litiges.';
  END IF;
  IF v_current IN ('paid', 'rejected', 'reimbursed') THEN
    RAISE EXCEPTION 'Cette demande est déjà clôturée (%)', v_current;
  END IF;

  UPDATE public.vendor_payouts p
     SET status       = p_status,
         reference    = COALESCE(NULLIF(p_reference, ''), p.reference),
         note         = COALESCE(NULLIF(p_note, ''), p.note),
         processed_at = CASE WHEN p_status IN ('paid', 'rejected') THEN NOW() ELSE p.processed_at END
   WHERE p.id = p_payout_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.process_payout(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. CE QUE VOIT LE VENDEUR
--
--  La table est déjà lisible par son propriétaire ; cette fonction ajoute
--  seulement ce qu'un écran a besoin de savoir sans le recalculer : le reçu
--  est-il disponible, et jusqu'à quand puis-je contester.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_payouts(p_vendor_id UUID)
RETURNS TABLE (
  id UUID, amount INTEGER, method TEXT, phone TEXT, status TEXT,
  note TEXT, reference TEXT,
  requested_at TIMESTAMPTZ, processed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ, dispute_reason TEXT,
  dispute_outcome TEXT, dispute_note TEXT, dispute_resolved_at TIMESTAMPTZ,
  invoice_number TEXT, invoice_url TEXT,
  can_get_receipt BOOLEAN, can_dispute BOOLEAN, dispute_deadline TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE v_days INTEGER;
BEGIN
  IF NOT (public.owns_vendor(p_vendor_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Cette boutique n''est pas la vôtre';
  END IF;

  SELECT COALESCE(pp.payout_dispute_days, 15) INTO v_days
  FROM public.platform_policy pp WHERE pp.id;
  v_days := COALESCE(v_days, 15);

  RETURN QUERY
  SELECT p.id, p.amount, p.method, p.phone, p.status,
         p.note, p.reference, p.requested_at, p.processed_at,
         p.disputed_at, p.dispute_reason,
         p.dispute_outcome, p.dispute_note, p.dispute_resolved_at,
         p.invoice_number, p.invoice_url,
         -- Un reçu atteste d'un versement : il n'existe que s'il a eu lieu.
         (p.status IN ('paid', 'disputed')),
         (p.status = 'paid'
          AND COALESCE(p.processed_at, p.requested_at) + (v_days || ' days')::INTERVAL >= NOW()),
         COALESCE(p.processed_at, p.requested_at) + (v_days || ' days')::INTERVAL
  FROM public.vendor_payouts p
  WHERE p.vendor_id = p_vendor_id
  ORDER BY p.requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.my_payouts(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_payouts(UUID) TO authenticated;
