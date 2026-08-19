/* ════════════════════════════════════════════════════════════════════════════
   36 — PAYER SANS ERREUR, ET VOIR CE QU'ON VA CHERCHER

   Deux corrections que le premier vrai parcours a fait remonter.

   1. LE PAIEMENT ÉCHOUAIT. `payer_relais` insérait dans `orders (…, total, …)`
      alors que la colonne s'appelle `total_amount`. La commande n'était jamais
      créée, le bouton « Payer » renvoyait « column total does not exist », et
      le relais restait bloqué à l'état `arrive` — donc aucun bon crédité,
      aucune commission, et un client debout au comptoir avec un vendeur qui
      ne comprend pas. On aligne l'insertion sur la vraie table, celle que le
      panier remplit depuis toujours, et on écrit aussi la ligne d'article :
      sans elle la commande s'affiche vide dans le tableau de bord du vendeur.

   2. LE CLIENT NE VOYAIT QU'UN NOM. `mon_relais` renvoyait `libelle` et rien
      d'autre. On demande à quelqu'un de traverser un marché pour un article
      dont il n'a pas l'image — c'est le moment du parcours où l'on peut
      encore le perdre, et c'est celui où on lui en montrait le moins. On
      ajoute la photo de l'article, et les coordonnées de la boutique de
      départ pour pouvoir tracer le chemin dans l'application.
   ════════════════════════════════════════════════════════════════════════════ */

SET lock_timeout = '5s';

/* ── 1. LE PAIEMENT ──────────────────────────────────────────────────────────
   Les colonnes obligatoires de `orders` sont celles que remplit le panier :
   nom, téléphone et adresse du client. Au comptoir il n'y a pas d'adresse de
   livraison — le client est déjà sur place — donc on y écrit la boutique.
   C'est vrai, c'est lisible dans le tableau de bord, et ça ne ment pas sur ce
   qui s'est passé.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.payer_relais(
  p_relais_id UUID, p_reference TEXT DEFAULT NULL
)
RETURNS TABLE (order_id UUID, montant INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r          public.relais;
  v_order    UUID;
  v_nom      TEXT;
  v_tel      TEXT;
  v_boutique TEXT;
  v_repere   TEXT;
  v_img      TEXT;
BEGIN
  SELECT * INTO r FROM public.relais WHERE id = p_relais_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Relais introuvable'; END IF;
  IF r.client_id <> auth.uid() THEN RAISE EXCEPTION 'Ce relais n''est pas le vôtre'; END IF;
  IF r.etat <> 'arrive' THEN
    RAISE EXCEPTION 'Le code doit d''abord être validé au comptoir';
  END IF;

  -- Le client s'est peut-être inscrit en deux gestes au comptoir : il n'a
  -- alors ni nom ni téléphone renseignés. On ne bloque pas un paiement pour
  -- ça — la commande doit exister, quitte à porter « Client au comptoir ».
  SELECT coalesce(nullif(btrim(p.full_name), ''), 'Client au comptoir'),
         coalesce(nullif(btrim(p.phone), ''), '—')
    INTO v_nom, v_tel
    FROM public.profiles p
   WHERE p.id = r.client_id;

  v_nom := coalesce(v_nom, 'Client au comptoir');
  v_tel := coalesce(v_tel, '—');

  SELECT v.shop_name, v.pickup_label INTO v_boutique, v_repere
    FROM public.vendors v WHERE v.id = r.receveur_id;

  SELECT pr.img INTO v_img FROM public.products pr WHERE pr.id = r.product_id;

  INSERT INTO public.orders (
    user_id, vendor_id, total_amount, status, payment_method,
    payment_reference, client_name, client_phone, client_address,
    delivery_fee, fulfilment, relais_id
  )
  VALUES (
    -- `payment_method` reprend une valeur que le panier écrit déjà : le
    -- règlement se fait sur place, à la remise de l'article. Inventer un
    -- libellé ici risquerait de heurter une contrainte, et le paiement du
    -- relais est précisément ce qu'on est en train de réparer.
    r.client_id, r.receveur_id, r.prix_paye, 'paid', 'cash_on_delivery',
    p_reference, v_nom, v_tel,
    'Retrait au comptoir — ' || coalesce(v_boutique, 'boutique')
      || coalesce(' (' || nullif(btrim(v_repere), '') || ')', ''),
    0, 'comptoir', r.id
  )
  ON CONFLICT (relais_id) WHERE relais_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_order;

  -- Rejeu (double clic, réseau qui repart) : la commande existe déjà.
  IF v_order IS NULL THEN
    SELECT id INTO v_order FROM public.orders WHERE relais_id = r.id;
  ELSE
    -- Sans ligne d'article, la commande s'affiche vide côté vendeur et il ne
    -- sait pas ce qu'il vient de vendre.
    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_img, quantity, unit_price
    )
    VALUES (v_order, r.product_id, r.libelle, v_img, 1, r.prix_paye);
  END IF;

  UPDATE public.relais
     SET etat = 'paye', paye_le = NOW(), order_id = v_order
   WHERE id = r.id AND etat = 'arrive';

  RETURN QUERY SELECT v_order, r.prix_paye;
END
$$;

/* ── 2. CE QUE LE CLIENT VOIT ────────────────────────────────────────────────
   La photo de l'article, et les deux bouts du chemin. Un appel ouvert n'a pas
   de `product_id` — le vendeur a saisi l'article à la volée — donc `img` est
   nul dans ce cas, et l'écran doit le supporter.
   ──────────────────────────────────────────────────────────────────────────── */

DROP FUNCTION IF EXISTS public.mon_relais();

CREATE OR REPLACE FUNCTION public.mon_relais()
RETURNS TABLE (
  id UUID, libelle TEXT, code TEXT, etat TEXT, mode TEXT,
  prix_affiche INTEGER, prix_paye INTEGER, remise INTEGER,
  distance_m INTEGER, expire_le TIMESTAMPTZ,
  boutique TEXT, boutique_id UUID, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  repere TEXT, envoye_par TEXT,
  img TEXT,
  depart_nom TEXT, depart_lat DOUBLE PRECISION, depart_lng DOUBLE PRECISION,
  logo TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.libelle, r.code, r.etat, r.mode,
         r.prix_affiche, r.prix_paye, r.remise, r.distance_m, r.expire_le,
         v.shop_name, v.id, v.pickup_lat, v.pickup_lng, v.pickup_label, e.shop_name,
         p.img,
         e.shop_name, e.pickup_lat, e.pickup_lng,
         v.logo_url
    FROM public.relais r
    JOIN public.vendors v          ON v.id = r.receveur_id
    JOIN public.vendors e          ON e.id = r.emetteur_id
    LEFT JOIN public.products p    ON p.id = r.product_id
   WHERE r.client_id = auth.uid()
     AND r.etat IN ('attribue', 'arrive', 'paye')
   ORDER BY r.created_at DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.mon_relais()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.payer_relais(UUID, TEXT)    TO authenticated;
