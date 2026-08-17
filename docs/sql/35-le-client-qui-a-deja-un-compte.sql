/* ════════════════════════════════════════════════════════════════════════════
   35 — LE CLIENT QUI A DÉJÀ UN COMPTE, ET L'AFFICHE DU COMPTOIR

   Le diagnostic disait tout : 5 demandes, 5 appels, 3 réponses « oui », et
   ensuite plus rien — 0 relais, 0 présence. Le circuit fonctionne jusqu'à
   l'arbitrage et s'arrête à l'attribution, parce qu'aucun client ne s'est
   jamais signalé.

   Deux causes, et il faut les deux corrections.

   La première est de conception : on avait supposé que tout client arrive
   neuf, par /r/<code>, et se crée un compte sur place. Celui qui a déjà un
   compte et qui est déjà connecté sur son téléphone n'avait aucun chemin — il
   n'existait pas de geste pour dire « je suis dans cette boutique ». Cela se
   règle côté écran, et l'appel à `signaler_presence` ne change pas.

   La seconde est ici : `signaler_presence` résout la boutique sur
   `vendors.referral_code`, alors que le reste de l'application range les codes
   d'affiliation sur `profiles`. Si cette colonne est vide, l'affiche du
   comptoir ne pointe sur rien et aucun scan ne peut aboutir, quel que soit
   l'écran. On la crée si besoin, et on la remplit pour toutes les boutiques.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Le code d'affiliation de la boutique ─────────────────────────────────────
   C'est lui qu'on imprime sur le comptoir. Il se lit à voix haute et se tape
   à une main : ni 0/O ni 1/I, qui se confondent sur un autocollant sali.
   ──────────────────────────────────────────────────────────────────────────── */

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE OR REPLACE FUNCTION public.code_boutique()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  essai TEXT;
BEGIN
  LOOP
    essai := '';
    FOR i IN 1..6 LOOP
      essai := essai || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;
    -- Un code déjà pris enverrait les clients d'une boutique chez une autre.
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.vendors WHERE upper(referral_code) = essai);
  END LOOP;
  RETURN essai;
END $$;

-- Toutes les boutiques qui n'en avaient pas en reçoivent un.
UPDATE public.vendors
   SET referral_code = public.code_boutique()
 WHERE referral_code IS NULL OR btrim(referral_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS vendors_referral_code_uniq
  ON public.vendors (upper(referral_code));

-- Toute boutique créée après cette migration en reçoit un à l'insertion : sans
-- code, elle n'aurait pas d'affiche, donc aucun client, donc aucun relais.
CREATE OR REPLACE FUNCTION public.vendor_code_auto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL OR btrim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.code_boutique();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vendor_code_auto ON public.vendors;
CREATE TRIGGER trg_vendor_code_auto
  BEFORE INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.vendor_code_auto();

/* ── Reconnaître une boutique par son code ───────────────────────────────────
   L'écran du client affiche le nom de la boutique avant de valider. Taper six
   caractères et voir apparaître « Marché de Mboppi — Quincaillerie Belle Vue »
   fait la différence entre un geste sûr et un geste hésitant.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.boutique_par_code(p_code TEXT)
RETURNS TABLE (vendor_id UUID, boutique TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.shop_name
    FROM public.vendors v
   WHERE upper(v.referral_code) = upper(btrim(p_code))
   LIMIT 1;
$$;

/* ── Se signaler présent ─────────────────────────────────────────────────────
   Inchangée dans son principe, mais elle ne suppose plus que l'appelant arrive
   de /r/<code> : un client déjà connecté peut désormais taper le code lui-même
   depuis « Mon relais ». Le message d'erreur devient exploitable — c'est un
   client debout devant un comptoir qui va le lire.
   ──────────────────────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.signaler_presence(p_referral_code TEXT)
RETURNS TABLE (code TEXT, boutique TEXT, expire_le TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_vendor    UUID;
  v_boutique  TEXT;
  v_code      TEXT;
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connecte-toi pour signaler ta présence.';
  END IF;

  SELECT v.id, v.shop_name INTO v_vendor, v_boutique
    FROM public.vendors v
   WHERE upper(v.referral_code) = upper(btrim(p_referral_code));

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Aucune boutique ne porte le code %. Vérifie l''affiche du comptoir.',
      upper(btrim(coalesce(p_referral_code, '')));
  END IF;

  -- Un client n'est présent qu'à un seul comptoir à la fois. S'il s'est
  -- signalé ailleurs il y a dix minutes, cette présence-là n'a plus de sens :
  -- deux vendeurs pourraient l'attacher au même moment.
  UPDATE public.presences_comptoir
     SET utilisee = TRUE
   WHERE user_id = v_uid AND NOT utilisee;

  v_code := '';
  FOR i IN 1..4 LOOP
    v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
  END LOOP;

  INSERT INTO public.presences_comptoir (vendor_id, user_id, code, expire_le)
  VALUES (v_vendor, v_uid, v_code, NOW() + INTERVAL '15 minutes');

  RETURN QUERY SELECT v_code, v_boutique, (NOW() + INTERVAL '15 minutes')::TIMESTAMPTZ;
END $$;

GRANT EXECUTE ON FUNCTION public.boutique_par_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signaler_presence(TEXT)  TO authenticated;

/* ── Vérification ────────────────────────────────────────────────────────────
   Après application, ceci doit renvoyer 0 boutique sans code.
   ──────────────────────────────────────────────────────────────────────────── */
-- SELECT count(*) FILTER (WHERE referral_code IS NULL OR btrim(referral_code) = '') AS sans_code,
--        count(*) AS boutiques
--   FROM public.vendors;
