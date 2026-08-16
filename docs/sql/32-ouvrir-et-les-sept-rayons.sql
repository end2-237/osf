-- ════════════════════════════════════════════════════════════════════════════
--  OUVRIR À LA MAIN, ET LES SEPT AUTRES RAYONS
--
--  DEUX CHOSES.
--
--  1. UN RAYON NEUF EST EN « CONSTRUCTION », et `vendor_rayon()` ne renvoie que
--     les rayons ACTIFS. Une boutique affectée à un rayon en construction ne
--     voit donc rien dans son tableau de bord — c'est voulu en production, et
--     insupportable en test.
--
--     `admin_maj_rayon` accepte maintenant `p_force`. Sans lui, la règle tient :
--     on n'ouvre pas un rayon dont une famille motrice n'a pas ses porteurs,
--     parce qu'avant ce seuil un relais sur deux échoue et qu'un commerçant qui
--     se plante deux fois n'utilise plus jamais le mécanisme. Avec lui, on ouvre
--     quand même — pour essayer le circuit à deux boutiques, ce que le terrain
--     ne pardonnerait pas mais qu'un développeur doit pouvoir faire.
--
--  2. LES SEPT AUTRES RAYONS du document 1, montés comme le premier : familles,
--     catégories de recrutement, et le lien entre les deux. Tous dans la même
--     zone, et ce n'est pas un détail — cinq rayons dans un quartier valent
--     mieux qu'un rayon dans cinq quartiers. C'est vers le cinquième que
--     l'acheteur commence à ouvrir l'application avant de sortir de chez lui,
--     et donc que les ventes se font sans que personne n'ait envoyé personne.
--
--     Ils naissent tous en « construction ». On les ouvre un par un, dans
--     l'ordre du document 1, et seulement quand la famille motrice a ses
--     porteurs.
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
     WHERE n.nspname = 'public' AND p.proname = 'admin_maj_rayon'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$reset$;

-- ════════════════════════════════════════════════════════════════════════════
--  1. OUVRIR, SUSPENDRE, ET FORCER QUAND ON SAIT CE QU'ON FAIT
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_maj_rayon(
  p_rayon_id  UUID,
  p_statut    TEXT    DEFAULT NULL,
  p_perimetre INTEGER DEFAULT NULL,
  p_plancher  INTEGER DEFAULT NULL,
  p_nom       TEXT    DEFAULT NULL,
  p_zone      TEXT    DEFAULT NULL,
  p_ville     TEXT    DEFAULT NULL,
  p_min       INTEGER DEFAULT NULL,
  p_max       INTEGER DEFAULT NULL,
  p_force     BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bloc INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Réservé au super admin'; END IF;

  IF p_statut = 'actif' AND NOT p_force THEN
    SELECT COUNT(*) INTO v_bloc FROM public.familles f
     WHERE f.rayon_id = p_rayon_id AND f.role = 'moteur' AND NOT f.ouverte;
    IF v_bloc > 0 THEN
      RAISE EXCEPTION
        '% famille(s) motrice(s) sous leur seuil de porteurs. Ouvrir maintenant fera échouer un relais sur deux.', v_bloc;
    END IF;
  END IF;

  UPDATE public.rayons
     SET nom            = COALESCE(NULLIF(p_nom, ''),   nom),
         zone           = COALESCE(NULLIF(p_zone, ''),  zone),
         ville          = COALESCE(NULLIF(p_ville, ''), ville),
         statut         = COALESCE(p_statut, statut),
         perimetre_m    = COALESCE(p_perimetre, perimetre_m),
         plancher_recus = COALESCE(p_plancher, plancher_recus),
         min_boutiques  = COALESCE(p_min, min_boutiques),
         max_boutiques  = COALESCE(p_max, max_boutiques),
         ouvert_le      = CASE WHEN p_statut = 'actif' AND ouvert_le IS NULL
                               THEN CURRENT_DATE ELSE ouvert_le END
   WHERE id = p_rayon_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_maj_rayon(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
--  2. LES SEPT AUTRES RAYONS
--
--  Une seule description, en données, et une seule boucle. Sept copies du même
--  bloc auraient divergé au premier changement — et il y en aura, parce que le
--  nombre de variantes de chaque famille doit être recompté sur place.
-- ════════════════════════════════════════════════════════════════════════════
DO $seed$
DECLARE
  spec JSONB := $json$
[
 {"nom":"Beauté et cheveux","boutiques":15,
  "familles":[
    {"nom":"Mèches, tissages, perruques","v":150,"role":"moteur"},
    {"nom":"Produits capillaires","v":55,"role":"appoint"},
    {"nom":"Soins visage et corps","v":40,"role":"appoint"},
    {"nom":"Ongles et pose","v":15,"role":"appoint"},
    {"nom":"Parfums","v":25,"role":"appoint"},
    {"nom":"Maquillage teint","v":100,"role":"appoint"}],
  "categories":[
    {"nom":"Mèches et perruques","q":4,"p":"receveuse","g":"produit","a":15000,
     "f":["Mèches, tissages, perruques","Produits capillaires","Ongles et pose"]},
    {"nom":"Beauté généraliste","q":3,"p":"receveuse","g":"produit","a":15000,
     "f":["Mèches, tissages, perruques","Produits capillaires","Soins visage et corps","Parfums"]},
    {"nom":"Produits capillaires","q":2,"p":"emettrice","g":"produit","a":15000,
     "f":["Produits capillaires","Mèches, tissages, perruques","Soins visage et corps"]},
    {"nom":"Soins visage et corps","q":1,"p":"emettrice","g":"produit","a":15000,
     "f":["Soins visage et corps","Mèches, tissages, perruques","Maquillage teint"]},
    {"nom":"Ongles et pose","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Ongles et pose","Mèches, tissages, perruques"]},
    {"nom":"Parfums","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Parfums","Soins visage et corps"]},
    {"nom":"Accessoires de coiffure","q":1,"p":"specialiste","g":"produit","a":5000,
     "f":["Mèches, tissages, perruques"]},
    {"nom":"Salon de coiffure et de pose","q":2,"p":"service","g":"service","a":5000,
     "f":["Mèches, tissages, perruques","Produits capillaires","Ongles et pose"]}]},

 {"nom":"Téléphone et informatique","boutiques":12,
  "familles":[
    {"nom":"Smartphone neuf","v":60,"role":"moteur"},
    {"nom":"Téléphone d'occasion","v":90,"role":"moteur"},
    {"nom":"Coques, verres, câbles, chargeurs","v":30,"role":"appoint"},
    {"nom":"Écouteurs et enceintes","v":25,"role":"appoint"},
    {"nom":"Batteries externes et solaire","v":15,"role":"appoint"},
    {"nom":"Informatique et bureautique","v":40,"role":"appoint"}],
  "categories":[
    {"nom":"Téléphone neuf","q":3,"p":"receveuse","g":"produit","a":15000,
     "f":["Smartphone neuf","Coques, verres, câbles, chargeurs","Écouteurs et enceintes"]},
    {"nom":"Téléphone d'occasion","q":3,"p":"emettrice","g":"produit","a":15000,
     "f":["Téléphone d'occasion","Smartphone neuf","Coques, verres, câbles, chargeurs"]},
    {"nom":"Téléphone généraliste","q":2,"p":"receveuse","g":"produit","a":15000,
     "f":["Smartphone neuf","Téléphone d'occasion","Coques, verres, câbles, chargeurs","Écouteurs et enceintes","Batteries externes et solaire"]},
    {"nom":"Accessoires et audio","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Coques, verres, câbles, chargeurs","Écouteurs et enceintes","Batteries externes et solaire"]},
    {"nom":"Énergie mobile et solaire","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Batteries externes et solaire","Coques, verres, câbles, chargeurs"]},
    {"nom":"Réparation et pièces","q":1,"p":"service","g":"service","a":5000,
     "f":["Téléphone d'occasion","Coques, verres, câbles, chargeurs"]},
    {"nom":"Point SIM, crédit et Mobile Money","q":1,"p":"service","g":"service","a":5000,
     "f":[]}]},

 {"nom":"Vêtement et tissu","boutiques":16,
  "familles":[
    {"nom":"Prêt-à-porter femme","v":180,"role":"moteur"},
    {"nom":"Prêt-à-porter homme","v":110,"role":"moteur"},
    {"nom":"Tissu, pagne, wax, bazin","v":130,"role":"moteur"},
    {"nom":"Friperie","v":35,"role":"moteur"},
    {"nom":"Vêtement enfant et layette","v":60,"role":"appoint"},
    {"nom":"Sous-vêtements et bonneterie","v":25,"role":"appoint"},
    {"nom":"Ceintures, sacs, foulards","v":20,"role":"appoint"}],
  "categories":[
    {"nom":"Prêt-à-porter femme","q":4,"p":"receveuse","g":"produit","a":15000,
     "f":["Prêt-à-porter femme","Ceintures, sacs, foulards","Sous-vêtements et bonneterie"]},
    {"nom":"Prêt-à-porter homme","q":3,"p":"receveuse","g":"produit","a":15000,
     "f":["Prêt-à-porter homme","Ceintures, sacs, foulards"]},
    {"nom":"Prêt-à-porter généraliste","q":2,"p":"receveuse","g":"produit","a":15000,
     "f":["Prêt-à-porter femme","Prêt-à-porter homme","Vêtement enfant et layette","Ceintures, sacs, foulards"]},
    {"nom":"Friperie","q":2,"p":"emettrice","g":"produit","a":15000,
     "f":["Friperie","Prêt-à-porter femme","Prêt-à-porter homme","Vêtement enfant et layette"]},
    {"nom":"Tissu, pagne et bazin","q":3,"p":"emettrice","g":"produit","a":15000,
     "f":["Tissu, pagne, wax, bazin"]},
    {"nom":"Sous-vêtements et bonneterie","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Sous-vêtements et bonneterie","Vêtement enfant et layette"]},
    {"nom":"Couture et retouche","q":1,"p":"service","g":"service","a":5000,
     "f":["Tissu, pagne, wax, bazin"]}]},

 {"nom":"Maison et cuisine","boutiques":12,
  "familles":[
    {"nom":"Vaisselle et ustensiles","v":70,"role":"moteur"},
    {"nom":"Plastique et rangement","v":25,"role":"appoint"},
    {"nom":"Petit électroménager","v":45,"role":"appoint"},
    {"nom":"Literie et linge de maison","v":35,"role":"appoint"},
    {"nom":"Matelas","v":12,"role":"appoint"},
    {"nom":"Rideaux et décoration","v":30,"role":"appoint"},
    {"nom":"Gaz et réchauds","v":8,"role":"service"}],
  "categories":[
    {"nom":"Vaisselle et ustensiles","q":3,"p":"receveuse","g":"produit","a":15000,
     "f":["Vaisselle et ustensiles","Plastique et rangement","Petit électroménager"]},
    {"nom":"Articles ménagers généraliste","q":2,"p":"receveuse","g":"produit","a":15000,
     "f":["Vaisselle et ustensiles","Plastique et rangement","Petit électroménager","Literie et linge de maison","Rideaux et décoration"]},
    {"nom":"Plastique et rangement","q":1,"p":"emettrice","g":"produit","a":15000,
     "f":["Plastique et rangement","Vaisselle et ustensiles"]},
    {"nom":"Petit électroménager","q":2,"p":"emettrice","g":"produit","a":15000,
     "f":["Petit électroménager","Vaisselle et ustensiles"]},
    {"nom":"Literie et linge de maison","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Literie et linge de maison","Matelas","Rideaux et décoration"]},
    {"nom":"Matelas","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Matelas","Literie et linge de maison"]},
    {"nom":"Rideaux et décoration","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Rideaux et décoration","Literie et linge de maison"]},
    {"nom":"Gaz, réchauds et accessoires","q":1,"p":"service","g":"produit","a":5000,
     "f":["Gaz et réchauds","Vaisselle et ustensiles"]}]},

 {"nom":"Électroménager et énergie","boutiques":12,
  "familles":[
    {"nom":"Froid","v":55,"role":"moteur"},
    {"nom":"Télévision et décodeur","v":45,"role":"moteur"},
    {"nom":"Son : enceintes, home cinéma","v":30,"role":"appoint"},
    {"nom":"Climatisation et ventilation","v":25,"role":"appoint"},
    {"nom":"Onduleur, batterie, solaire, groupe","v":40,"role":"appoint"}],
  "categories":[
    {"nom":"Froid : frigo, congélateur, vitrine","q":3,"p":"receveuse","g":"produit","a":15000,
     "f":["Froid","Climatisation et ventilation"]},
    {"nom":"Télévision et son","q":3,"p":"receveuse","g":"produit","a":15000,
     "f":["Télévision et décodeur","Son : enceintes, home cinéma"]},
    {"nom":"Électroménager généraliste","q":2,"p":"receveuse","g":"produit","a":15000,
     "f":["Froid","Télévision et décodeur","Son : enceintes, home cinéma","Climatisation et ventilation","Onduleur, batterie, solaire, groupe"]},
    {"nom":"Climatisation et ventilation","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Climatisation et ventilation","Froid"]},
    {"nom":"Énergie, onduleur et solaire","q":2,"p":"emettrice","g":"produit","a":15000,
     "f":["Onduleur, batterie, solaire, groupe","Télévision et décodeur"]},
    {"nom":"Installation, livraison et réparation","q":1,"p":"service","g":"service","a":5000,
     "f":["Froid","Télévision et décodeur","Climatisation et ventilation"]}]},

 {"nom":"Quincaillerie, auto et moto","boutiques":15,
  "familles":[
    {"nom":"Pièces auto, parc dominant","v":120,"role":"moteur"},
    {"nom":"Pièces moto","v":60,"role":"moteur"},
    {"nom":"Pneus, batteries, huiles","v":30,"role":"appoint"},
    {"nom":"Quincaillerie et outillage","v":50,"role":"appoint"},
    {"nom":"Électricité du bâtiment","v":35,"role":"appoint"},
    {"nom":"Peinture et finition","v":20,"role":"appoint"}],
  "categories":[
    {"nom":"Pièces auto du parc dominant","q":5,"p":"receveuse","g":"produit","a":15000,
     "f":["Pièces auto, parc dominant","Pneus, batteries, huiles"]},
    {"nom":"Pièces moto","q":3,"p":"receveuse","g":"produit","a":15000,
     "f":["Pièces moto","Pneus, batteries, huiles"]},
    {"nom":"Pièces généraliste auto et moto","q":2,"p":"receveuse","g":"produit","a":15000,
     "f":["Pièces auto, parc dominant","Pièces moto","Pneus, batteries, huiles","Quincaillerie et outillage"]},
    {"nom":"Pneus, batteries et huiles","q":1,"p":"emettrice","g":"produit","a":15000,
     "f":["Pneus, batteries, huiles","Pièces auto, parc dominant"]},
    {"nom":"Quincaillerie et outillage","q":2,"p":"emettrice","g":"produit","a":15000,
     "f":["Quincaillerie et outillage","Électricité du bâtiment","Peinture et finition"]},
    {"nom":"Électricité du bâtiment","q":1,"p":"specialiste","g":"produit","a":15000,
     "f":["Électricité du bâtiment","Quincaillerie et outillage"]},
    {"nom":"Garage et mécanicien","q":1,"p":"service","g":"service","a":5000,
     "f":["Pièces auto, parc dominant","Pièces moto","Pneus, batteries, huiles"]}]},

 {"nom":"Bébé et enfant","boutiques":11,
  "familles":[
    {"nom":"Puériculture","v":40,"role":"moteur"},
    {"nom":"Couches, hygiène, alimentation","v":20,"role":"appoint"},
    {"nom":"Jouets","v":45,"role":"appoint"},
    {"nom":"Maternité et allaitement","v":15,"role":"appoint"},
    {"nom":"Articles scolaires","v":25,"role":"appoint"}],
  "categories":[
    {"nom":"Puériculture","q":3,"p":"receveuse","g":"produit","a":5000,
     "f":["Puériculture","Couches, hygiène, alimentation","Maternité et allaitement"]},
    {"nom":"Bébé généraliste","q":2,"p":"receveuse","g":"produit","a":5000,
     "f":["Puériculture","Couches, hygiène, alimentation","Jouets","Maternité et allaitement"]},
    {"nom":"Couches, hygiène et alimentation infantile","q":2,"p":"emettrice","g":"produit","a":5000,
     "f":["Couches, hygiène, alimentation","Maternité et allaitement"]},
    {"nom":"Jouets","q":2,"p":"emettrice","g":"produit","a":5000,
     "f":["Jouets","Articles scolaires"]},
    {"nom":"Maternité et allaitement","q":1,"p":"specialiste","g":"produit","a":5000,
     "f":["Maternité et allaitement","Puériculture","Couches, hygiène, alimentation"]},
    {"nom":"Articles scolaires","q":1,"p":"specialiste","g":"produit","a":5000,
     "f":["Articles scolaires","Jouets"]}]}
]
$json$::JSONB;

  -- Préfixés v_ : PL/pgSQL ne distingue pas la casse, donc une variable

  -- nommée VILLE serait confondue avec la colonne ville de la table rayons.

  v_zone  CONSTANT TEXT := 'Marché Mboppi';
  v_ville CONSTANT TEXT := 'Douala';

  r JSONB; f JSONB; c JSONB;
  v_rayon UUID; v_cat UUID; v_total INTEGER;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(spec) LOOP

    ---------------------------------------------------------------- le rayon
    SELECT id INTO v_rayon FROM public.rayons
     WHERE ville = v_ville AND zone = v_zone AND nom = r->>'nom';

    IF v_rayon IS NULL THEN
      INSERT INTO public.rayons (nom, zone, ville, perimetre_m,
                                 min_boutiques, max_boutiques, plancher_recus, statut)
      VALUES (r->>'nom', v_zone, v_ville, 500, 8, 16, 60, 'construction')
      RETURNING id INTO v_rayon;
    END IF;

    -------------------------------------------------------------- les familles
    -- Le nombre de variantes est la seule donnée saisie du modèle. Ces valeurs
    -- viennent du document 2, posées de mémoire : elles doivent être recomptées
    -- sur place, une heure par famille, avant tout recrutement.
    FOR f IN SELECT * FROM jsonb_array_elements(r->'familles') LOOP
      INSERT INTO public.familles (rayon_id, nom, variantes, role)
      VALUES (v_rayon, f->>'nom', (f->>'v')::INTEGER, f->>'role')
      ON CONFLICT (rayon_id, lower(nom)) DO UPDATE
        SET variantes = EXCLUDED.variantes, role = EXCLUDED.role;
    END LOOP;

    ------------------------------------------------------------ les catégories
    FOR c IN SELECT * FROM jsonb_array_elements(r->'categories') LOOP
      INSERT INTO public.categories_rayon (rayon_id, nom, quota, profil, genre, abonnement, ordre)
      VALUES (v_rayon, c->>'nom', (c->>'q')::INTEGER, c->>'p', c->>'g', (c->>'a')::INTEGER,
              COALESCE((SELECT MAX(ordre) + 1 FROM public.categories_rayon WHERE rayon_id = v_rayon), 1))
      ON CONFLICT (rayon_id, lower(nom)) DO UPDATE
        SET quota = EXCLUDED.quota, profil = EXCLUDED.profil,
            genre = EXCLUDED.genre, abonnement = EXCLUDED.abonnement
      RETURNING id INTO v_cat;

      -- Suggestion, pas contrainte : la console coche ces familles d'avance et
      -- l'équipe terrain corrige d'après ce qu'elle a vu sur l'étagère.
      DELETE FROM public.categorie_famille WHERE categorie_id = v_cat;
      INSERT INTO public.categorie_famille (categorie_id, famille_id)
      SELECT v_cat, fam.id
        FROM public.familles fam
       WHERE fam.rayon_id = v_rayon
         AND fam.nom IN (SELECT jsonb_array_elements_text(c->'f'))
      ON CONFLICT DO NOTHING;
    END LOOP;

    PERFORM public.rafraichir_familles(v_rayon);

    SELECT SUM(quota) INTO v_total FROM public.categories_rayon WHERE rayon_id = v_rayon;
    RAISE NOTICE '% : % boutiques à recruter (visé %)',
      r->>'nom', v_total, r->>'boutiques';
  END LOOP;
END
$seed$;

-- ════════════════════════════════════════════════════════════════════════════
--  3. OÙ ON EN EST
-- ════════════════════════════════════════════════════════════════════════════
-- select nom, statut, boutiques, familles_ouvertes || '/' || familles as sous_rayons,
--        round(couverture * 100) as couverture, prete
--   from public.admin_rayons();
