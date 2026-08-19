/* ════════════════════════════════════════════════════════════════════════════
   37 — L'ARGENT DU RELAIS PASSE PAR LA PLATEFORME

   Jusqu'ici `payer_relais` créait la commande déjà marquée « payée ». C'était
   une déclaration, pas un paiement : aucun franc ne bougeait, et le modèle
   entier repose sur le contraire. La commission de 3 %, le bon de 5 % de
   l'envoyeur, le prix net du receveur — les trois sortent d'un encaissement.
   S'il n'a pas lieu, il n'y a rien à répartir, et `confirmer_remise` crédite
   des bons adossés à du vide.

   Désormais le relais emprunte exactement le circuit du panier : commande en
   `pending_payment`, poussée USSD Orange ou MTN par `monetbil-init`, et c'est
   le webhook de l'opérateur — pas le téléphone du client — qui déclare le
   paiement.

   D'où le déclencheur ci-dessous. Le client paie sur l'écran de son opérateur,
   souvent en quittant le navigateur, parfois en le fermant. Faire avancer le
   relais depuis l'application supposerait qu'il revienne ; beaucoup ne
   reviennent pas. La commande passe à `paid`, le relais suit, et cela reste
   vrai si le téléphone s'est éteint entre-temps.

   TANT QUE LE PAIEMENT N'ABOUTIT PAS, LE RELAIS RESTE À `arrive`. Il peut
   réessayer avec un autre numéro, ou renoncer — et dans ce cas l'article part
   dans son panier plutôt que d'être perdu. C'est traité côté écran : le panier
   vit dans le navigateur.
   ════════════════════════════════════════════════════════════════════════════ */

SET lock_timeout = '5s';

/* ── 1. LA COMMANDE NAÎT EN ATTENTE DE PAIEMENT ────────────────────────────── */

-- La signature change : l'opérateur choisi par le client entre en paramètre.
-- On écrit dans `payment_method` la même valeur que le panier ('orange_money'
-- ou 'mtn_momo') plutôt qu'un libellé inventé, qui heurterait une contrainte
-- au pire moment — celui où l'on répare justement le paiement.
DROP FUNCTION IF EXISTS public.payer_relais(UUID, TEXT);
DROP FUNCTION IF EXISTS public.payer_relais(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.payer_relais(
  p_relais_id UUID,
  p_reference TEXT DEFAULT NULL,
  p_moyen     TEXT DEFAULT 'orange_money'
)
RETURNS TABLE (order_id UUID, montant INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r          public.relais;
  v_order    UUID;
  v_etat     TEXT;
  v_nom      TEXT;
  v_tel      TEXT;
  v_boutique TEXT;
  v_repere   TEXT;
  v_img      TEXT;
BEGIN
  SELECT * INTO r FROM public.relais WHERE id = p_relais_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Relais introuvable'; END IF;
  IF r.client_id <> auth.uid() THEN RAISE EXCEPTION 'Ce relais n''est pas le vôtre'; END IF;
  IF r.etat NOT IN ('arrive', 'paye') THEN
    RAISE EXCEPTION 'Le code doit d''abord être validé au comptoir';
  END IF;

  -- Une commande existe déjà pour ce relais : tentative précédente abandonnée
  -- ou refusée. On la réutilise si elle attend encore, on la relance si elle a
  -- échoué. Créer une seconde commande doublerait le chiffre d'affaires du
  -- vendeur pour une seule vente.
  SELECT id, status INTO v_order, v_etat
    FROM public.orders WHERE relais_id = r.id;

  IF v_order IS NOT NULL THEN
    IF v_etat IN ('payment_failed', 'cancelled') THEN
      UPDATE public.orders
         SET status = 'pending_payment',
             payment_reference = p_reference,
             payment_method = CASE WHEN p_moyen IN ('orange_money', 'mtn_momo')
                                   THEN p_moyen ELSE payment_method END
       WHERE id = v_order;
    END IF;
    RETURN QUERY SELECT v_order, r.prix_paye;
    RETURN;
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
    -- `pending_payment` : le même état que le panier avant la poussée USSD.
    -- C'est le webhook de l'opérateur qui le fera passer à `paid`, jamais
    -- l'application.
    r.client_id, r.receveur_id, r.prix_paye, 'pending_payment',
    CASE WHEN p_moyen IN ('orange_money', 'mtn_momo') THEN p_moyen ELSE 'orange_money' END,
    p_reference, v_nom, v_tel,
    'Retrait au comptoir — ' || coalesce(v_boutique, 'boutique')
      || coalesce(' (' || nullif(btrim(v_repere), '') || ')', ''),
    0, 'comptoir', r.id
  )
  ON CONFLICT (relais_id) WHERE relais_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_order;

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

  -- On rattache la commande au relais, mais on NE change PAS son état : il
  -- reste `arrive` tant que l'argent n'est pas encaissé.
  UPDATE public.relais SET order_id = v_order WHERE id = r.id;

  RETURN QUERY SELECT v_order, r.prix_paye;
END
$$;

/* ── 2. LE RELAIS SUIT LA COMMANDE, PAS LE NAVIGATEUR ─────────────────────── */

CREATE OR REPLACE FUNCTION public.relais_suit_le_paiement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.relais_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'paid' AND coalesce(OLD.status, '') <> 'paid' THEN
    UPDATE public.relais
       SET etat = 'paye', paye_le = NOW(), order_id = NEW.id
     WHERE id = NEW.relais_id
       AND etat = 'arrive';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_relais_suit_le_paiement ON public.orders;
CREATE TRIGGER trg_relais_suit_le_paiement
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.relais_suit_le_paiement();

/* ── 3. CE QUE L'ÉCRAN DU CLIENT A BESOIN DE SAVOIR ────────────────────────────
   `product_id` pour pouvoir remettre l'article dans le panier s'il renonce,
   et l'état de la commande pour distinguer « à payer » de « paiement en
   cours ». Un appel ouvert n'a pas de `product_id` : l'article a été saisi à
   la volée par le vendeur et n'existe dans aucun catalogue. L'écran doit le
   supporter — il ne pourra pas proposer le panier dans ce cas.
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
  logo TEXT,
  product_id UUID, order_id UUID, order_etat TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.libelle, r.code, r.etat, r.mode,
         r.prix_affiche, r.prix_paye, r.remise, r.distance_m, r.expire_le,
         v.shop_name, v.id, v.pickup_lat, v.pickup_lng, v.pickup_label, e.shop_name,
         p.img,
         e.shop_name, e.pickup_lat, e.pickup_lng,
         v.logo_url,
         r.product_id, o.id, o.status
    FROM public.relais r
    JOIN public.vendors v          ON v.id = r.receveur_id
    JOIN public.vendors e          ON e.id = r.emetteur_id
    LEFT JOIN public.products p    ON p.id = r.product_id
    LEFT JOIN public.orders o      ON o.relais_id = r.id
   WHERE r.client_id = auth.uid()
     AND r.etat IN ('attribue', 'arrive', 'paye')
   ORDER BY r.created_at DESC
   LIMIT 1;
$$;

/* ── 4. RENONCER AU COMPTOIR ─────────────────────────────────────────────────
   Il est venu, il n'a pas payé, il repart. Ce n'est pas un échec du modèle :
   c'est un client qui a vu l'article et qui hésite. On libère le relais et on
   annule la commande en attente — l'article, lui, part dans son panier, mais
   ça se passe dans le navigateur.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.renoncer_au_comptoir(p_relais_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.relais;
BEGIN
  SELECT * INTO r FROM public.relais WHERE id = p_relais_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Relais introuvable'; END IF;
  IF r.client_id <> auth.uid() THEN RAISE EXCEPTION 'Ce relais n''est pas le vôtre'; END IF;
  IF r.etat = 'paye' THEN
    RAISE EXCEPTION 'Ce relais est déjà payé.';
  END IF;

  UPDATE public.orders
     SET status = 'cancelled'
   WHERE relais_id = r.id AND status IN ('pending_payment', 'payment_failed');

  UPDATE public.relais SET etat = 'annule' WHERE id = r.id AND etat IN ('attribue', 'arrive');
END $$;

GRANT EXECUTE ON FUNCTION public.mon_relais()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.payer_relais(UUID, TEXT, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.renoncer_au_comptoir(UUID)       TO authenticated;
