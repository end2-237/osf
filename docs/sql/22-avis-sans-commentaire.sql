-- ════════════════════════════════════════════════════════════════════════════
--  UNE NOTE SANS COMMENTAIRE EST UN AVIS
--
--  La table `reviews` portait une contrainte qui exigeait un texte d'au moins
--  dix caractères, texte obligatoire. Elle venait du formulaire d'avis de la
--  fiche produit, où l'on écrit vraiment quelque chose.
--
--  Depuis, la fenêtre qui s'ouvre à la livraison propose de noter en une
--  seconde, commentaire facultatif. Les deux règles se contredisaient : le
--  client mettait cinq étoiles et la base refusait la ligne —
--
--      new row for relation "reviews" violates check constraint
--      "reviews_text_check"
--
--  Or c'est exactement l'avis qu'on veut le plus : celui d'un acheteur qui a
--  réellement reçu sa commande. Exiger une rédaction à ce moment-là, c'est
--  choisir d'avoir moins d'avis vérifiés.
--
--  La règle devient donc : pas de texte, ou un texte qui dit quelque chose.
--  Trois mots jetés ne valent pas mieux que rien.
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
       AND p.proname IN ('submit_order_reviews')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. LA RÈGLE, SUR LES DEUX TABLES D'AVIS
--
--  On efface toute contrainte de vérification qui parle de `text`, quel que
--  soit son nom : celle d'origine s'appelait `reviews_text_check`, mais rien
--  ne garantit qu'il n'en existe pas une autre sous un autre nom sur une base
--  plus ancienne. On repose ensuite la nôtre, nommée et commentée.
-- ════════════════════════════════════════════════════════════════════════════
DO $regle$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
      FROM pg_constraint c
      JOIN pg_class     t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname IN ('reviews', 'vendor_reviews')
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%text%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END
$regle$;

ALTER TABLE public.reviews ADD CONSTRAINT reviews_text_check
  CHECK (text IS NULL OR char_length(btrim(text)) >= 10);

ALTER TABLE public.vendor_reviews ADD CONSTRAINT vendor_reviews_text_check
  CHECK (text IS NULL OR char_length(btrim(text)) >= 10);

COMMENT ON CONSTRAINT reviews_text_check ON public.reviews IS
  'Pas de texte, ou un texte qui dit quelque chose. Une note en étoiles seule '
  'est un avis valable — c''est même le plus fréquent après une livraison.';

-- ════════════════════════════════════════════════════════════════════════════
--  2. LE DÉPÔT D'AVIS APRÈS LIVRAISON
--
--  Deux changements par rapport à la version précédente :
--
--  · un commentaire trop court est refusé AVANT l'insertion, avec une phrase
--    lisible. Une violation de contrainte brute ne dit rien au client, et
--    l'écran ne peut rien en faire non plus ;
--
--  · le refus porte sur le commentaire, jamais sur la note. Le client qui
--    tape « top » corrige trois mots, il ne perd pas ses cinq étoiles.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_order_reviews(
  p_order_id    UUID,
  p_shop_rating SMALLINT,
  p_shop_text   TEXT  DEFAULT NULL,
  p_items       JSONB DEFAULT '[]'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  public.orders;
  v_vendor UUID;
  v_name   TEXT;
  v_item   JSONB;
  v_pid    UUID;
  v_rating SMALLINT;
  v_text   TEXT;
  v_count  INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  -- Un avis vaut parce qu'il vient de l'acheteur, sur une commande livrée.
  IF v_order.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette commande n''est pas la vôtre';
  END IF;
  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'On note une commande une fois livrée.';
  END IF;
  IF p_shop_rating IS NULL OR p_shop_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Donne une note à la boutique, de 1 à 5 étoiles.';
  END IF;

  v_vendor := v_order.vendor_id;

  SELECT COALESCE(NULLIF(BTRIM(pr.full_name), ''), 'Client Buyticle')
    INTO v_name FROM public.profiles pr WHERE pr.id = auth.uid();
  v_name := COALESCE(v_name, 'Client Buyticle');

  -- Le commentaire boutique, vérifié avant d'écrire quoi que ce soit : on ne
  -- veut pas la moitié des avis enregistrés et l'autre refusée.
  v_text := NULLIF(BTRIM(COALESCE(p_shop_text, '')), '');
  IF v_text IS NOT NULL AND char_length(v_text) < 10 THEN
    RAISE EXCEPTION 'Ton commentaire sur la boutique est trop court : dis-en un peu plus, ou laisse-le vide.';
  END IF;

  FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_items, '[]'::JSONB))
  LOOP
    v_text := NULLIF(BTRIM(COALESCE(v_item ->> 'text', '')), '');
    IF v_text IS NOT NULL AND char_length(v_text) < 10 THEN
      RAISE EXCEPTION 'Un de tes commentaires produit est trop court : dis-en un peu plus, ou laisse-le vide.';
    END IF;
  END LOOP;

  -- ── Les avis produit ──
  FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_items, '[]'::JSONB))
  LOOP
    v_pid    := NULLIF(v_item ->> 'product_id', '')::UUID;
    v_rating := NULLIF(v_item ->> 'rating', '')::SMALLINT;
    v_text   := NULLIF(BTRIM(COALESCE(v_item ->> 'text', '')), '');

    CONTINUE WHEN v_pid IS NULL OR v_rating IS NULL OR v_rating NOT BETWEEN 1 AND 5;

    -- On ne note que ce qu'on a acheté dans cette commande.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM public.order_items oi
       WHERE oi.order_id = p_order_id AND oi.product_id = v_pid
    );

    -- On cherche puis on écrit, plutôt qu'un ON CONFLICT : rien ne garantit
    -- qu'un index unique (product_id, user_id) existe sur toutes les bases,
    -- et une clause ON CONFLICT sans index correspondant échoue à l'exécution.
    UPDATE public.reviews r
       SET rating = v_rating,
           text   = COALESCE(v_text, r.text)
     WHERE r.product_id = v_pid AND r.user_id = auth.uid();

    IF NOT FOUND THEN
      INSERT INTO public.reviews (product_id, user_id, user_name, rating, text, approved)
      VALUES (v_pid, auth.uid(), v_name, v_rating, v_text, TRUE);
    END IF;
    v_count := v_count + 1;
  END LOOP;

  -- ── L'avis boutique ──
  IF v_vendor IS NOT NULL THEN
    INSERT INTO public.vendor_reviews (vendor_id, order_id, user_id, user_name, rating, text)
    VALUES (v_vendor, p_order_id, auth.uid(), v_name, p_shop_rating,
            NULLIF(BTRIM(COALESCE(p_shop_text, '')), ''))
    ON CONFLICT (order_id) DO UPDATE
      SET rating = EXCLUDED.rating,
          text   = COALESCE(EXCLUDED.text, public.vendor_reviews.text);
  END IF;

  UPDATE public.orders o SET reviewed_at = NOW() WHERE o.id = p_order_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_reviews(UUID, SMALLINT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_order_reviews(UUID, SMALLINT, TEXT, JSONB) TO authenticated;
