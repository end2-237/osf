/* ════════════════════════════════════════════════════════════════════════════
   38 — LE SOLDE DU RELAIS

   Un relais validé, payé, terminé — et le solde du vendeur n'a pas bougé.
   Trois causes, empilées.

   1. `confirmer_remise` marquait la commande `delivered` mais ne posait pas
      `delivered_at`. Or `vendor_balance` libère l'argent sur la date de
      livraison : sans elle, la fenêtre de rétention ne s'écoule jamais et la
      somme reste indéfiniment en « attente de confirmation ». L'argent était
      là, invisible et immobile.

   2. Le receveur aurait été crédité de `total_amount`, c'est-à-dire du prix
      payé par le client — commission de Buyticle et bon de l'envoyeur
      compris. Il ne doit toucher que son prix net. Le relais est le seul type
      de commande où le montant encaissé n'est pas le montant dû au vendeur, et
      `vendor_balance` l'ignorait.

   3. Les relais réglés avant la migration 37 portent `cash_on_delivery` :
      aucun argent n'a transité par la plateforme, et ils ne doivent donc rien
      alimenter. La requête de contrôle en fin de fichier dit dans quel cas on
      se trouve.

   Et puisque le bon de l'envoyeur n'avait toujours pas de sortie, on lui en
   donne trois : le garder pour ses propres remises, payer son abonnement, ou
   le retirer en argent à partir de 15 000 F.
   ════════════════════════════════════════════════════════════════════════════ */

SET lock_timeout = '5s';

/* ── 1. DEUX FILES DE RETRAIT DANS LA MÊME TABLE ─────────────────────────────
   Le bon et les ventes sont deux poches différentes. Sans cette colonne, un
   retrait de bon serait déduit du solde des ventes — le vendeur perdrait deux
   fois la même somme.
   ──────────────────────────────────────────────────────────────────────────── */

ALTER TABLE public.vendor_payouts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'ventes';

ALTER TABLE public.vendor_payouts DROP CONSTRAINT IF EXISTS vendor_payouts_source_valid;
ALTER TABLE public.vendor_payouts
  ADD CONSTRAINT vendor_payouts_source_valid CHECK (source IN ('ventes', 'bon'));

/* ── 2. LA REMISE LIBÈRE L'ARGENT ────────────────────────────────────────────
   Le client a appuyé sur « J'ai mon article », debout au comptoir, l'article
   en main. C'est la confirmation la plus forte qui existe dans tout le
   système — plus forte qu'une livraison à domicile, où le doute demeure. Il
   n'y a donc aucune fenêtre de rétention à observer : on pose `delivered_at`
   et `client_confirmed_at` du même geste, et l'argent est disponible.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.confirmer_remise(p_relais_id UUID)
RETURNS TABLE (net_vendeur INTEGER, bon_emetteur INTEGER, commission INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.relais;
BEGIN
  SELECT * INTO r FROM public.relais WHERE id = p_relais_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Relais introuvable'; END IF;
  IF r.etat = 'remis' THEN
    -- Déjà confirmé : on ne crédite pas deux fois, et ce n'est pas une erreur.
    RETURN QUERY SELECT r.prix_net, r.bon, r.commission;
    RETURN;
  END IF;
  IF r.etat <> 'paye' THEN RAISE EXCEPTION 'Le relais n''est pas payé'; END IF;

  UPDATE public.relais SET etat = 'remis', remis_le = NOW() WHERE id = r.id;

  UPDATE public.orders
     SET status              = 'delivered',
         delivered_at        = COALESCE(delivered_at, NOW()),
         client_confirmed_at = COALESCE(client_confirmed_at, NOW())
   WHERE id = r.order_id;

  -- Le bon de celui qui a envoyé. Il n'existe pas avant cette ligne.
  INSERT INTO public.bon_mouvements (vendor_id, montant, motif, relais_id, note)
  VALUES (r.emetteur_id, r.bon, 'relais', r.id, r.libelle)
  ON CONFLICT (relais_id) WHERE motif = 'relais' DO NOTHING;

  RETURN QUERY SELECT r.prix_net, r.bon, r.commission;
END
$$;

/* ── 3. LE SOLDE COMPTE LE RELAIS À SON PRIX NET ──────────────────────────────
   Même fonction qu'en 20, à deux détails près : une commande de relais vaut
   `prix_net` et non `total_amount`, et les retraits de bon ne sont pas
   déduits de la poche des ventes.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.vendor_balance(p_vendor_id UUID)
RETURNS TABLE (collected BIGINT, withdrawn BIGINT, pending BIGINT,
               available BIGINT, held BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
           -- Un relais : le vendeur touche son prix net, pas ce que le client
           -- a payé. La différence est la commission et le bon de l'envoyeur,
           -- et elle ne lui a jamais appartenu.
           CASE
             WHEN rl.id IS NOT NULL THEN rl.prix_net
             ELSE o.total_amount
                  + CASE WHEN v_mode = 'self' THEN COALESCE(o.delivery_fee, 0) ELSE 0 END
           END AS montant,
           (o.payment_method IN ('orange_money', 'mtn_momo')
            OR v_mode = 'buyticle') AS encaisse_par_nous,
           o.status, o.return_status, o.delivered_at,
           o.funds_released_at, o.client_confirmed_at
    FROM public.orders o
    LEFT JOIN public.relais rl ON rl.id = o.relais_id AND rl.etat = 'remis'
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

  -- Seuls les retraits pris sur les ventes. Ceux pris sur le bon sortent
  -- d'une autre poche et sont décomptés par `solde_bon`.
  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status IN ('paid', 'disputed') AND source = 'ventes';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status IN ('pending', 'processing') AND source = 'ventes';

  RETURN QUERY SELECT v_collected, v_withdrawn, v_pending,
                      GREATEST(v_collected - v_withdrawn - v_pending, 0),
                      v_held;
END;
$$;

/* ── 4. RATTRAPAGE DES RELAIS DÉJÀ TERMINÉS ───────────────────────────────────
   Ceux qui ont été confirmés avant ce fichier n'ont pas de `delivered_at` :
   leur argent est bloqué en « attente » pour toujours. On le débloque.
   Rien n'est créé ni crédité — on ne fait que dater ce qui a eu lieu.
   ──────────────────────────────────────────────────────────────────────────── */

UPDATE public.orders o
   SET delivered_at        = COALESCE(o.delivered_at, r.remis_le, NOW()),
       client_confirmed_at = COALESCE(o.client_confirmed_at, r.remis_le, NOW())
  FROM public.relais r
 WHERE r.id = o.relais_id
   AND r.etat = 'remis'
   AND o.status = 'delivered'
   AND (o.delivered_at IS NULL OR o.client_confirmed_at IS NULL);

/* ── 5. LE BON A TROIS SORTIES ───────────────────────────────────────────────
   Il les avait déjà en base — `remise_client`, `abonnement`, `retrait` — mais
   aucune n'était atteignable depuis un écran. On ajoute le plancher de retrait
   et les deux fonctions qui manquaient.

   Le plancher a une raison : sous 15 000 F, les frais de collecte de
   l'opérateur mangent une part indécente du versement. Au-dessous, le bon vaut
   plus cher gardé que retiré — et gardé, il finance des remises qui ramènent
   des clients.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.depenser_bon(
  p_vendor_id UUID, p_montant INTEGER, p_motif TEXT, p_note TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_solde INTEGER; v_retirable INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_montant <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF p_motif NOT IN ('remise_client', 'abonnement', 'retrait') THEN
    RAISE EXCEPTION 'Motif de dépense invalide';
  END IF;

  SELECT s.solde, s.retirable INTO v_solde, v_retirable
    FROM public.solde_bon(p_vendor_id) s;

  IF p_montant > v_solde THEN RAISE EXCEPTION 'Solde insuffisant'; END IF;

  IF p_motif = 'retrait' THEN
    IF p_montant < 15000 THEN
      RAISE EXCEPTION 'Le retrait commence à 15 000 F. En dessous, les frais de l''opérateur mangent le versement.';
    END IF;
    IF p_montant > v_retirable THEN
      RAISE EXCEPTION 'Retirable seulement après 30 jours (% F disponibles)', v_retirable;
    END IF;
  END IF;

  INSERT INTO public.bon_mouvements (vendor_id, montant, motif, note)
  VALUES (p_vendor_id, -p_montant, p_motif, p_note);

  RETURN v_solde - p_montant;
END
$$;

/* Retirer en argent : on débite le bon ET on met la demande dans la file des
   versements, celle que l'admin traite déjà. Un seul endroit d'où l'argent
   sort de la plateforme. */
CREATE OR REPLACE FUNCTION public.retirer_bon(
  p_vendor_id UUID, p_montant INTEGER, p_method TEXT
)
RETURNS public.vendor_payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone TEXT; v_row public.vendor_payouts;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_method NOT IN ('orange_money', 'mtn_momo') THEN
    RAISE EXCEPTION 'Moyen de retrait invalide';
  END IF;

  SELECT CASE WHEN p_method = 'orange_money' THEN momo_orange_number ELSE momo_mtn_number END
    INTO v_phone
    FROM public.vendor_payout_settings WHERE vendor_id = p_vendor_id;

  IF v_phone IS NULL OR v_phone = '' THEN
    RAISE EXCEPTION 'Renseigne d''abord ton numéro pour ce moyen de paiement';
  END IF;

  -- Débite d'abord : si le solde ne suffit pas, rien n'entre dans la file.
  PERFORM public.depenser_bon(p_vendor_id, p_montant, 'retrait', 'Retrait du bon de relais');

  INSERT INTO public.vendor_payouts (vendor_id, amount, method, phone, source, note)
  VALUES (p_vendor_id, p_montant, p_method, v_phone, 'bon', 'Bon de relais')
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

/* Payer son abonnement avec le bon. Il n'y a pas d'encaissement : le bon est
   déjà de l'argent de la plateforme, on le convertit sans le faire sortir.
   C'est le cas où il coûte le moins cher à honorer, et celui où il rend le
   plus — l'abonnement payé est un vendeur qui reste. */
ALTER TABLE public.subscription_orders DROP CONSTRAINT IF EXISTS sub_orders_method_valid;
ALTER TABLE public.subscription_orders
  ADD CONSTRAINT sub_orders_method_valid CHECK (method IN ('monetbil', 'agency', 'bon'));

CREATE OR REPLACE FUNCTION public.payer_abonnement_avec_bon(p_vendor_id UUID)
RETURNS public.subscription_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.subscription_orders; v_solde INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = p_vendor_id AND v.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_row
    FROM public.subscription_orders so
   WHERE so.vendor_id = p_vendor_id AND so.status = 'pending'
   ORDER BY so.created_at DESC LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Aucun abonnement en attente de paiement. Choisis d''abord un forfait.';
  END IF;

  SELECT s.solde INTO v_solde FROM public.solde_bon(p_vendor_id) s;
  IF v_solde < v_row.amount THEN
    RAISE EXCEPTION 'Il te manque % F de bon pour cet abonnement.', v_row.amount - v_solde;
  END IF;

  PERFORM public.depenser_bon(p_vendor_id, v_row.amount, 'abonnement',
                              'Abonnement ' || COALESCE(v_row.to_plan, ''));

  UPDATE public.subscription_orders so
     SET status = 'paid', method = 'bon', settled_at = NOW()
   WHERE so.id = v_row.id
  RETURNING * INTO v_row;

  -- Le forfait prend effet ici, comme dans `validate_subscription`.
  UPDATE public.vendors v
     SET plan            = v_row.to_plan,
         plan_since      = NOW(),
         plan_expires_at = NOW() + (v_row.months || ' months')::INTERVAL
   WHERE v.id = v_row.vendor_id;

  RETURN v_row;
END $$;

/* Le journal du bon, pour l'écran des retraits. */
CREATE OR REPLACE FUNCTION public.mouvements_bon(p_vendor_id UUID, p_limite INTEGER DEFAULT 30)
RETURNS TABLE (id UUID, montant INTEGER, motif TEXT, note TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT bm.id, bm.montant, bm.motif, bm.note, bm.created_at
    FROM public.bon_mouvements bm
    JOIN public.vendors v ON v.id = bm.vendor_id
   WHERE bm.vendor_id = p_vendor_id
     AND (v.user_id = auth.uid() OR public.is_super_admin())
   ORDER BY bm.created_at DESC
   LIMIT COALESCE(p_limite, 30);
$$;

GRANT EXECUTE ON FUNCTION public.vendor_balance(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmer_remise(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.depenser_bon(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retirer_bon(UUID, INTEGER, TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.payer_abonnement_avec_bon(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.mouvements_bon(UUID, INTEGER)           TO authenticated;

/* ════════════════════════════════════════════════════════════════════════════
   CONTRÔLE — à exécuter après la migration

   Dit, pour chaque relais terminé, si son argent est compté et pourquoi.
   `encaisse_par_nous = false` signifie que le relais a été réglé avant la
   migration 37 : aucun argent n'a transité, et il ne doit rien alimenter.
   ════════════════════════════════════════════════════════════════════════════ */
-- SELECT r.libelle, r.etat, r.prix_net, r.prix_paye,
--        o.status, o.payment_method, o.delivered_at, o.client_confirmed_at,
--        (o.payment_method IN ('orange_money','mtn_momo')) AS encaisse_par_nous
--   FROM public.relais r
--   LEFT JOIN public.orders o ON o.relais_id = r.id
--  WHERE r.etat = 'remis'
--  ORDER BY r.remis_le DESC;
