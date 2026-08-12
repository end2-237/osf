-- ════════════════════════════════════════════════════════════════════════════
--  PREUVE DE REMISE — le code de livraison
--
--  La rétention de 48 h protège le client d'un vendeur qui marque « livré »
--  sans livrer. Elle ne protège personne dans l'autre sens : un client qui a
--  bien reçu peut affirmer le contraire, geler l'argent, et c'est la parole de
--  l'un contre celle de l'autre.
--
--  Un code règle ça. Quatre chiffres, générés au départ de la course, connus
--  du seul client. Le livreur ne peut clore qu'en les saisissant.
--
--      remise AVEC code  → la réception est PROUVÉE.
--                          « je n'ai rien reçu » devient irrecevable ;
--                          un défaut produit reste contestable.
--      remise SANS code  → la réception n'est pas prouvée.
--                          En cas de litige, le doute profite au client.
--
--  Le code ne raccourcit pas la fenêtre de 48 h : il tranche la question
--  « ai-je reçu ? », pas la question « le produit est-il conforme ? ». Les
--  deux sont distinctes et méritent chacune leur réponse.
--
--  Idempotent : rejouable sans dommage.
-- ════════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';

-- ════════════════════════════════════════════════════════════════════════════
--  Les anciennes signatures partent d'abord. PostgreSQL refuse de changer le
--  type de retour d'une fonction existante, et laisser cohabiter deux
--  `advance_course` rendrait chaque appel ambigu.
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.request_return(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_returns(TEXT);
DROP FUNCTION IF EXISTS public.my_delivered_orders();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_code    TEXT,
  ADD COLUMN IF NOT EXISTS code_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_proof   TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS return_kind      TEXT;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_proof_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_proof_valid
  CHECK (delivery_proof IN ('none', 'code'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_return_kind_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_return_kind_valid
  CHECK (return_kind IS NULL
         OR return_kind IN ('not_received', 'damaged', 'wrong_item', 'other'));

COMMENT ON COLUMN public.orders.delivery_proof IS
  'code = le livreur a saisi le code du client, la réception est prouvée. '
  'none = remise non prouvée, le doute profite au client en cas de litige.';

-- ════════════════════════════════════════════════════════════════════════════
--  LE CODE
--  Quatre chiffres suffisent : il faut le deviner en une tentative, devant
--  quelqu'un qui a le colis en main. Un tirage plus long ne se retient pas.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ensure_delivery_code(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code TEXT;
BEGIN
  SELECT o.delivery_code INTO v_code FROM public.orders o WHERE o.id = p_order_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  v_code := LPAD((FLOOR(RANDOM() * 10000))::INT::TEXT, 4, '0');
  UPDATE public.orders o SET delivery_code = v_code WHERE o.id = p_order_id;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_delivery_code(UUID) FROM anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE FIL DE LA COURSE, AVEC LE CODE À L'ARRIVÉE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_course(
  p_order_id UUID,
  p_step     TEXT,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_code     TEXT DEFAULT NULL
)
RETURNS TABLE (
  status            TEXT,
  course_started_at TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  origin_lat        DOUBLE PRECISION,
  origin_lng        DOUBLE PRECISION,
  delivery_proof    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID; v_courier UUID; v_cuser UUID;
  v_started TIMESTAMPTZ; v_picked TIMESTAMPTZ; v_status TEXT; v_code TEXT;
  v_lat DOUBLE PRECISION; v_lng DOUBLE PRECISION; r public.delivery_rates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  IF p_step NOT IN ('start', 'pickup', 'finish') THEN
    RAISE EXCEPTION 'Étape inconnue : %', p_step;
  END IF;

  SELECT o.vendor_id, o.courier_id, o.course_started_at, o.picked_up_at,
         o.status, o.delivery_code
    INTO v_vendor, v_courier, v_started, v_picked, v_status, v_code
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT c.user_id INTO v_cuser FROM public.couriers c WHERE c.id = v_courier;

  IF NOT (public.is_super_admin()
          OR public.owns_vendor(v_vendor)
          OR v_cuser = auth.uid()) THEN
    RAISE EXCEPTION 'Cette course ne vous est pas accessible';
  END IF;

  IF v_status IN ('cancelled', 'payment_failed') THEN
    RAISE EXCEPTION 'Cette commande est annulée';
  END IF;
  IF v_status = 'delivered' THEN
    RAISE EXCEPTION 'Cette course est déjà terminée';
  END IF;
  IF v_courier IS NULL THEN
    RAISE EXCEPTION 'Attribue d''abord la course à un livreur';
  END IF;
  IF p_step IN ('pickup', 'finish') AND v_started IS NULL THEN
    RAISE EXCEPTION 'La course n''a pas encore démarré';
  END IF;
  IF p_step = 'finish' AND v_picked IS NULL THEN
    RAISE EXCEPTION 'Marque d''abord le colis comme récupéré';
  END IF;

  IF p_step = 'start' THEN
    SELECT * INTO r FROM public.delivery_rates dr WHERE dr.id;
    v_lat := COALESCE(p_lat, r.hub_lat);
    v_lng := COALESCE(p_lng, r.hub_lng);
    PERFORM public.ensure_delivery_code(p_order_id);

    UPDATE public.orders o
       SET course_started_at = COALESCE(o.course_started_at, NOW()),
           origin_lat        = COALESCE(o.origin_lat, v_lat),
           origin_lng        = COALESCE(o.origin_lng, v_lng),
           status            = 'in_transit'
     WHERE o.id = p_order_id;

  ELSIF p_step = 'pickup' THEN
    UPDATE public.orders o
       SET picked_up_at = COALESCE(o.picked_up_at, NOW()),
           status       = 'in_transit'
     WHERE o.id = p_order_id;

  ELSE
    -- Un code saisi doit être le bon. Un code absent est permis — le client
    -- peut être injoignable — mais la remise n'est alors pas prouvée, et le
    -- livreur en assume la conséquence en cas de litige.
    IF p_code IS NOT NULL AND BTRIM(p_code) <> '' THEN
      IF v_code IS NULL OR BTRIM(p_code) <> v_code THEN
        RAISE EXCEPTION 'Code incorrect. Demande au client le code affiché dans son suivi.';
      END IF;
      UPDATE public.orders o
         SET status = 'delivered', code_verified_at = NOW(), delivery_proof = 'code'
       WHERE o.id = p_order_id;
    ELSE
      UPDATE public.orders o
         SET status = 'delivered', delivery_proof = 'none'
       WHERE o.id = p_order_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT o.status::TEXT, o.course_started_at, o.picked_up_at, o.delivered_at,
         o.origin_lat, o.origin_lng, o.delivery_proof::TEXT
  FROM public.orders o WHERE o.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.advance_course(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE RETOUR, AVEC SA NATURE
--
--  « Jamais reçu » n'est pas « produit cassé ». La première affirmation est
--  vérifiable, la seconde ne l'est pas. On les sépare, et on refuse la
--  première quand le code a été saisi.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.request_return(
  p_order_id UUID,
  p_reason   TEXT,
  p_kind     TEXT DEFAULT 'other'
)
RETURNS TABLE (return_status TEXT, deadline TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID; v_status TEXT; v_delivered TIMESTAMPTZ;
  v_ret TEXT; v_window INTEGER; v_deadline TIMESTAMPTZ;
  v_verified TIMESTAMPTZ; v_confirmed TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF COALESCE(BTRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Explique la raison du retour';
  END IF;
  IF COALESCE(p_kind, 'other') NOT IN ('not_received', 'damaged', 'wrong_item', 'other') THEN
    RAISE EXCEPTION 'Motif inconnu';
  END IF;

  SELECT o.user_id, o.status, o.delivered_at, o.return_status,
         o.code_verified_at, o.client_confirmed_at
    INTO v_user, v_status, v_delivered, v_ret, v_verified, v_confirmed
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
  IF v_confirmed IS NOT NULL THEN
    RAISE EXCEPTION 'Tu as déjà confirmé la bonne réception de cette commande';
  END IF;

  -- Le code n'a pu être saisi que par quelqu'un qui l'avait en main.
  IF p_kind = 'not_received' AND v_verified IS NOT NULL THEN
    RAISE EXCEPTION 'Le code de livraison a été saisi lors de la remise : la réception est établie. Choisis le motif qui correspond au problème réel.';
  END IF;

  SELECT pp.return_window_hours INTO v_window FROM public.platform_policy pp WHERE pp.id;
  v_deadline := COALESCE(v_delivered, NOW()) + (v_window || ' hours')::INTERVAL;
  IF NOW() > v_deadline THEN
    RAISE EXCEPTION 'Le délai de % h est dépassé : le retour n''est plus possible', v_window;
  END IF;

  UPDATE public.orders o
     SET return_status       = 'requested',
         return_kind         = COALESCE(p_kind, 'other'),
         return_reason       = BTRIM(p_reason),
         return_requested_at = NOW(),
         funds_released_at   = NULL
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT 'requested'::TEXT, v_deadline;
END;
$$;

REVOKE ALL ON FUNCTION public.request_return(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_return(UUID, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  CE QUE LE CLIENT DOIT AVOIR SOUS LES YEUX
--  Son code, et rien d'autre : il le lit au livreur au moment de la remise.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_active_deliveries()
RETURNS TABLE (
  id            UUID,
  order_number  TEXT,
  shop_name     TEXT,
  status        TEXT,
  total_amount  NUMERIC,
  delivery_code TEXT,
  started_at    TIMESTAMPTZ,
  picked_up_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  RETURN QUERY
  SELECT o.id, o.order_number::TEXT, v.shop_name::TEXT, o.status::TEXT,
         o.total_amount::NUMERIC, o.delivery_code::TEXT,
         o.course_started_at, o.picked_up_at
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.user_id = auth.uid()
    AND o.status NOT IN ('delivered', 'cancelled', 'payment_failed')
    AND o.delivery_code IS NOT NULL
  ORDER BY o.created_at DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.my_active_deliveries() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_active_deliveries() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  L'ARBITRAGE, AVEC LES FAITS
--
--  L'admin ne tranche pas au feeling : il voit si le code a été saisi, et
--  combien de litiges ce client a déjà ouverts. Un premier litige et un
--  dixième ne se lisent pas de la même façon.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_returns(p_status TEXT DEFAULT 'requested')
RETURNS TABLE (
  id              UUID,
  order_number    TEXT,
  shop_name       TEXT,
  vendor_id       UUID,
  client_name     TEXT,
  client_phone    TEXT,
  total_amount    NUMERIC,
  delivered_at    TIMESTAMPTZ,
  requested_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  return_status   TEXT,
  return_kind     TEXT,
  return_reason   TEXT,
  return_note     TEXT,
  funds_state     TEXT,
  delivery_proof  TEXT,
  client_disputes INTEGER,   -- litiges ouverts par ce client, tous vendeurs
  client_rejected INTEGER,   -- …dont combien ont été jugés infondés
  vendor_disputes INTEGER    -- litiges subis par cette boutique
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
         o.return_status::TEXT, o.return_kind::TEXT,
         o.return_reason::TEXT, o.return_note::TEXT,
         public.order_funds_state(o.id), o.delivery_proof::TEXT,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status <> 'none')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.user_id = o.user_id AND x.return_status = 'rejected')::INTEGER,
         (SELECT COUNT(*) FROM public.orders x
           WHERE x.vendor_id = o.vendor_id AND x.return_status <> 'none')::INTEGER
  FROM public.orders o
  LEFT JOIN public.vendors v ON v.id = o.vendor_id
  WHERE o.return_status <> 'none'
    AND (p_status IS NULL OR o.return_status = p_status)
  ORDER BY o.return_requested_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_returns(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_returns(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  LE PROFIL DU CLIENT EXPOSE LA PREUVE
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
  delivery_proof  TEXT,
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
         o.delivery_proof::TEXT,
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
