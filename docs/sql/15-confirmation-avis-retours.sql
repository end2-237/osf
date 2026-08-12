-- ════════════════════════════════════════════════════════════════════════════
--  CONFIRMATION DE RÉCEPTION, AVIS VÉRIFIÉS, RETOURS
--
--  LE PROBLÈME : rien n'empêchait une boutique de marquer « livré » sans avoir
--  livré. L'argent tombait dans son solde, et le client n'avait que ses yeux
--  pour pleurer.
--
--  LA RÉPONSE : le clic « livré » ne libère plus rien. Il ouvre une fenêtre.
--
--      livré  ──┬─→ le client confirme          → libéré tout de suite
--               ├─→ 48 h passent sans rien      → libéré automatiquement
--               └─→ le client demande un retour → gelé jusqu'à arbitrage
--
--  Tant que l'argent est retenu, il apparaît au vendeur en « en attente de
--  confirmation » : il le voit, il ne peut pas le retirer. C'est la même
--  fenêtre de 48 h qui autorise le retour et qui retient les fonds — une seule
--  horloge, donc pas de cas où l'une expire sans l'autre.
--
--  Les avis suivent la même logique : seul l'acheteur d'une commande livrée
--  peut noter, une seule fois, le produit ET la boutique. Un avis qui ne se
--  rattache à aucune commande n'existe pas.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  REJOUABLE DANS N'IMPORTE QUEL ORDRE
--
--  PostgreSQL refuse un CREATE OR REPLACE qui change la forme du retour, et
--  deux signatures d'une même fonction rendraient chaque appel ambigu. On
--  efface donc d'abord toutes les signatures des fonctions que ce fichier
--  redéfinit — quel que soit l'état de la base, et quel que soit l'ordre dans
--  lequel les fichiers ont été appliqués.
-- ════════════════════════════════════════════════════════════════════════════
DO $reset$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('admin_returns', 'confirm_delivery', 'my_delivered_orders', 'order_funds_state', 'request_return', 'resolve_return', 'submit_order_reviews', 'vendor_balance')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;


-- ════════════════════════════════════════════════════════════════════════════
--  1. LES DÉLAIS, EN UN SEUL ENDROIT
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.platform_policy (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  -- Fenêtre pendant laquelle le client peut demander un retour…
  return_window_hours INTEGER NOT NULL DEFAULT 48,
  -- …et pendant laquelle l'argent reste retenu. Les deux vont ensemble.
  funds_hold_hours    INTEGER NOT NULL DEFAULT 48,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.platform_policy (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_policy_read  ON public.platform_policy;
DROP POLICY IF EXISTS platform_policy_write ON public.platform_policy;
CREATE POLICY platform_policy_read  ON public.platform_policy FOR SELECT USING (TRUE);
CREATE POLICY platform_policy_write ON public.platform_policy FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  2. CE QUE LA COMMANDE RETIENT
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS funds_released_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_status        TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS return_reason        TEXT,
  ADD COLUMN IF NOT EXISTS return_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_resolved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_note          TEXT;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_return_status_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_return_status_valid
  CHECK (return_status IN ('none', 'requested', 'approved', 'rejected', 'returned'));

CREATE INDEX IF NOT EXISTS orders_return_open_idx ON public.orders(vendor_id)
  WHERE return_status = 'requested';

COMMENT ON COLUMN public.orders.funds_released_at IS
  'Quand l''argent est passé de « retenu » à « dû au vendeur ». NULL tant que '
  'le client n''a pas confirmé et que la fenêtre n''est pas écoulée.';

-- ════════════════════════════════════════════════════════════════════════════
--  3. AVIS SUR LA BOUTIQUE
--     Les avis produit vivent déjà dans `reviews`. Ceux qui portent sur la
--     boutique elle-même — le service, l'emballage, le délai — méritent leur
--     table : ils ne parlent pas de la même chose.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendor_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name  TEXT,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT,
  approved   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Une commande, un avis boutique. C'est ce qui rend l'avis vérifiable.
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS vendor_reviews_vendor_idx ON public.vendor_reviews(vendor_id);

ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_reviews_read   ON public.vendor_reviews;
DROP POLICY IF EXISTS vendor_reviews_admin  ON public.vendor_reviews;

-- Publics : c'est le but d'un avis.
CREATE POLICY vendor_reviews_read ON public.vendor_reviews
  FOR SELECT USING (approved OR user_id = auth.uid() OR public.is_super_admin());

-- L'écriture passe uniquement par `submit_order_reviews` : personne ne dépose
-- un avis sans commande livrée derrière.
CREATE POLICY vendor_reviews_admin ON public.vendor_reviews
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
--  4. L'ARGENT EST-IL LIBÉRÉ ?
--
--  Une seule fonction répond, et tout le reste s'y réfère : le solde, l'écran
--  vendeur, l'admin. Trois états, jamais d'ambiguïté.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.order_funds_state(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o public.orders; v_hold INTEGER;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  SELECT pp.funds_hold_hours INTO v_hold FROM public.platform_policy pp WHERE pp.id;

  IF o.status <> 'delivered'                          THEN RETURN 'pending';  END IF;
  IF o.return_status IN ('requested', 'approved',
                         'returned')                  THEN RETURN 'frozen';   END IF;
  IF o.funds_released_at IS NOT NULL
     OR o.client_confirmed_at IS NOT NULL             THEN RETURN 'released'; END IF;
  IF o.delivered_at IS NOT NULL
     AND o.delivered_at + (v_hold || ' hours')::INTERVAL <= NOW()
                                                      THEN RETURN 'released'; END IF;
  RETURN 'held';
END;
$$;

GRANT EXECUTE ON FUNCTION public.order_funds_state(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  5. LE SOLDE — ne compte que ce qui est libéré
--
--  Changement de fond : auparavant une commande payée en ligne alimentait le
--  solde dès l'encaissement, avant toute livraison. Ce n'est plus le cas.
--  Rien n'est dû tant que la réception n'est pas acquise.
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

  -- Ce que la plateforme détient pour cette boutique, livraison comprise
  -- quand la boutique livre elle-même et que le paiement est passé en ligne.
  WITH dus AS (
    SELECT o.id,
           o.total_amount
             + CASE WHEN v_mode = 'self' THEN COALESCE(o.delivery_fee, 0) ELSE 0 END
             AS montant,
           -- L'argent n'est entre nos mains que dans ces deux cas.
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

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.vendor_payouts
  WHERE vendor_id = p_vendor_id AND status = 'paid';

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
  'client ou fenêtre de rétention écoulée sans litige. Aucune commission.';

-- ════════════════════════════════════════════════════════════════════════════
--  6. LE CLIENT CONFIRME
--     Raccourci volontaire : confirmer libère l'argent immédiatement et ferme
--     la fenêtre de retour. On le dit clairement dans l'écran.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.confirm_delivery(p_order_id UUID)
RETURNS TABLE (confirmed_at TIMESTAMPTZ, funds_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user UUID; v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.user_id, o.status INTO v_user, v_status
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Cette commande n''est pas encore marquée livrée';
  END IF;

  UPDATE public.orders o
     SET client_confirmed_at = COALESCE(o.client_confirmed_at, NOW()),
         funds_released_at   = COALESCE(o.funds_released_at, NOW())
   WHERE o.id = p_order_id;

  RETURN QUERY
  SELECT o.client_confirmed_at, public.order_funds_state(p_order_id)
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_delivery(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  7. LE CLIENT DEMANDE UN RETOUR
--     Dans la fenêtre, et une seule fois. La demande gèle l'argent : c'est
--     précisément ce qui donne du poids à la réclamation.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_return(p_order_id UUID, p_reason TEXT)
RETURNS TABLE (return_status TEXT, deadline TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_delivered TIMESTAMPTZ;
  v_ret TEXT; v_window INTEGER; v_deadline TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF COALESCE(BTRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Explique la raison du retour';
  END IF;

  SELECT o.user_id, o.status, o.delivered_at, o.return_status
    INTO v_user, v_status, v_delivered, v_ret
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'Le retour n''est possible qu''une fois la commande livrée';
  END IF;
  IF v_ret <> 'none' THEN
    RAISE EXCEPTION 'Une demande de retour existe déjà pour cette commande';
  END IF;

  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;
  v_deadline := COALESCE(v_delivered, NOW()) + (v_window || ' hours')::INTERVAL;

  IF NOW() > v_deadline THEN
    RAISE EXCEPTION 'Le délai de % h est dépassé : le retour n''est plus possible', v_window;
  END IF;

  -- Confirmer puis se raviser n'est pas possible : la confirmation vaut solde
  -- de tout compte, et l'argent est déjà parti.
  IF EXISTS (SELECT 1 FROM public.orders o
              WHERE o.id = p_order_id AND o.client_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Tu as déjà confirmé la bonne réception de cette commande';
  END IF;

  UPDATE public.orders o
     SET return_status       = 'requested',
         return_reason       = BTRIM(p_reason),
         return_requested_at = NOW(),
         funds_released_at   = NULL      -- l'argent est regelé
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT 'requested'::TEXT, v_deadline;
END;
$$;

REVOKE ALL ON FUNCTION public.request_return(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_return(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  8. L'ADMIN ARBITRE
--     'approved'  → le client a raison : l'argent reste gelé, à rembourser.
--     'rejected'  → la boutique a raison : l'argent est libéré.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_return(
  p_order_id UUID,
  p_decision TEXT,
  p_note     TEXT DEFAULT NULL
)
RETURNS TABLE (return_status TEXT, funds_state TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ret TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'returned') THEN
    RAISE EXCEPTION 'Décision invalide';
  END IF;

  SELECT o.return_status INTO v_ret FROM public.orders o WHERE o.id = p_order_id;
  IF v_ret IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_ret = 'none' THEN RAISE EXCEPTION 'Aucune demande de retour sur cette commande'; END IF;

  UPDATE public.orders o
     SET return_status      = p_decision,
         return_note        = COALESCE(NULLIF(BTRIM(p_note), ''), o.return_note),
         return_resolved_at = NOW(),
         -- Retour refusé : la boutique est payée. Sinon l'argent reste gelé.
         funds_released_at  = CASE WHEN p_decision = 'rejected' THEN NOW() ELSE NULL END
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT p_decision, public.order_funds_state(p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_return(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_return(UUID, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  9. LES AVIS — produit ET boutique, en un seul geste
--
--  p_items : [{ "product_id": "…", "rating": 5, "text": "…" }, …]
--  Seul l'acheteur d'une commande livrée écrit, et une seule fois.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_order_reviews(
  p_order_id    UUID,
  p_shop_rating SMALLINT,
  p_shop_text   TEXT DEFAULT NULL,
  p_items       JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (product_reviews INTEGER, shop_review BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_vendor UUID; v_name TEXT;
  v_item JSONB; v_pid UUID; v_rating SMALLINT; v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  SELECT o.user_id, o.status, o.vendor_id, o.client_name
    INTO v_user, v_status, v_vendor, v_name
  FROM public.orders o WHERE o.id = p_order_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_status <> 'delivered' THEN
    RAISE EXCEPTION 'On ne note qu''une commande reçue';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders o
              WHERE o.id = p_order_id AND o.reviewed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Tu as déjà donné ton avis sur cette commande';
  END IF;
  IF p_shop_rating IS NULL OR p_shop_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Note la boutique de 1 à 5';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(p.full_name), ''), v_name, 'Client')
    INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

  -- Avis produit : uniquement sur ce qui a été acheté dans CETTE commande.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    v_pid    := (v_item ->> 'product_id')::UUID;
    v_rating := (v_item ->> 'rating')::SMALLINT;
    CONTINUE WHEN v_pid IS NULL OR v_rating IS NULL OR v_rating NOT BETWEEN 1 AND 5;

    IF NOT EXISTS (SELECT 1 FROM public.order_items oi
                    WHERE oi.order_id = p_order_id AND oi.product_id = v_pid) THEN
      CONTINUE;   -- pas dans la commande : on ignore plutôt que de refuser tout
    END IF;

    INSERT INTO public.reviews (product_id, user_id, user_name, rating, text, approved)
    VALUES (v_pid, auth.uid(), v_name, v_rating,
            NULLIF(BTRIM(v_item ->> 'text'), ''), TRUE)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  IF v_vendor IS NOT NULL THEN
    INSERT INTO public.vendor_reviews (vendor_id, order_id, user_id, user_name, rating, text)
    VALUES (v_vendor, p_order_id, auth.uid(), v_name, p_shop_rating,
            NULLIF(BTRIM(p_shop_text), ''))
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  UPDATE public.orders o SET reviewed_at = NOW() WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_count, v_vendor IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_reviews(UUID, SMALLINT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_order_reviews(UUID, SMALLINT, TEXT, JSONB) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  10. CE QUI ATTEND LE CLIENT
--      Alimente la fenêtre d'avis et les boutons de retour, sans exposer la
--      table des commandes.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_delivered_orders()
RETURNS TABLE (
  id              UUID,
  order_number    TEXT,
  shop_name       TEXT,
  vendor_id       UUID,
  total_amount    NUMERIC,
  delivered_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  return_status   TEXT,
  return_reason   TEXT,
  return_deadline TIMESTAMPTZ,
  can_return      BOOLEAN,
  items           JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_window INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.total_amount::NUMERIC, o.delivered_at, o.reviewed_at,
         o.client_confirmed_at, o.return_status::TEXT, o.return_reason::TEXT,
         COALESCE(o.delivered_at, o.created_at) + (v_window || ' hours')::INTERVAL,
         (o.return_status = 'none'
          AND o.client_confirmed_at IS NULL
          AND COALESCE(o.delivered_at, o.created_at)
              + (v_window || ' hours')::INTERVAL > NOW()),
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'product_id', oi.product_id,
                    'name',       oi.product_name,
                    'img',        oi.product_img,
                    'quantity',   oi.quantity))
           FROM public.order_items oi WHERE oi.order_id = o.id
         ), '[]'::JSONB)
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.user_id = auth.uid() AND o.status = 'delivered'
  ORDER BY o.delivered_at DESC NULLS LAST
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.my_delivered_orders() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_delivered_orders() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  11. LES RETOURS VUS DE L'ADMIN
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_returns(p_status TEXT DEFAULT 'requested')
RETURNS TABLE (
  id            UUID,
  order_number  TEXT,
  shop_name     TEXT,
  vendor_id     UUID,
  client_name   TEXT,
  client_phone  TEXT,
  total_amount  NUMERIC,
  delivered_at  TIMESTAMPTZ,
  requested_at  TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  return_status TEXT,
  return_reason TEXT,
  return_note   TEXT,
  funds_state   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.vendor_id,
         o.client_name::TEXT, o.client_phone::TEXT, o.total_amount::NUMERIC,
         o.delivered_at, o.return_requested_at, o.return_resolved_at,
         o.return_status::TEXT, o.return_reason::TEXT, o.return_note::TEXT,
         public.order_funds_state(o.id)
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.return_status <> 'none'
    AND (p_status IS NULL OR o.return_status = p_status)
  ORDER BY o.return_requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_returns(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_returns(TEXT) TO authenticated;
