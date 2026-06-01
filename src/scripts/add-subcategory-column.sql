-- Migration: add subcategory column to products table
-- Run in Supabase SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Populate subcategory from existing cj_category_name data
UPDATE products SET subcategory =
  CASE
    WHEN cj_category_name ILIKE '%headphone%' OR cj_category_name ILIKE '%casque%'                                          THEN 'Casques'
    WHEN cj_category_name ILIKE '%earphone%'  OR cj_category_name ILIKE '%earbuds%' OR cj_category_name ILIKE '%earpiece%'  THEN 'Écouteurs'
    WHEN cj_category_name ILIKE '%speaker%'   OR cj_category_name ILIKE '%soundbar%' OR cj_category_name ILIKE '%enceinte%' THEN 'Enceintes'
    WHEN cj_category_name ILIKE '%microphone%'                                                                               THEN 'Microphones'
    WHEN cj_category_name ILIKE '%phone%'
     AND cj_category_name NOT ILIKE '%earphone%'
     AND cj_category_name NOT ILIKE '%headphone%'                                                                            THEN 'Smartphones'
    WHEN cj_category_name ILIKE '%tablet%'    OR cj_category_name ILIKE '%ipad%'                                            THEN 'Tablettes'
    WHEN cj_category_name ILIKE '%laptop%'    OR cj_category_name ILIKE '%notebook%' OR cj_category_name ILIKE '%computer%' THEN 'Informatique'
    WHEN cj_category_name ILIKE '%gaming%'    OR cj_category_name ILIKE '%console%'  OR cj_category_name ILIKE '%game%'     THEN 'Gaming'
    WHEN cj_category_name ILIKE '%camera%'    OR cj_category_name ILIKE '%drone%'    OR cj_category_name ILIKE '%photo%'    THEN 'Photo & Vidéo'
    WHEN cj_category_name ILIKE '%charger%'   OR cj_category_name ILIKE '%cable%'    OR cj_category_name ILIKE '%power bank%' THEN 'Câbles & Chargeurs'
    WHEN cj_category_name ILIKE '%sneaker%'
      OR (cj_category_name ILIKE '%shoe%'
          AND cj_category_name NOT ILIKE '%boot%'
          AND cj_category_name NOT ILIKE '%sandal%')                                                                         THEN 'Sneakers'
    WHEN cj_category_name ILIKE '%boot%'                                                                                     THEN 'Bottes'
    WHEN cj_category_name ILIKE '%sandal%'    OR cj_category_name ILIKE '%slipper%'                                         THEN 'Sandales'
    WHEN cj_category_name ILIKE '%hoodie%'    OR cj_category_name ILIKE '%sweatshirt%' OR cj_category_name ILIKE '%pullover%' THEN 'Hoodies'
    WHEN cj_category_name ILIKE '%t-shirt%'   OR cj_category_name ILIKE '%tshirt%'                                          THEN 'T-Shirts'
    WHEN cj_category_name ILIKE '%pant%'      OR cj_category_name ILIKE '%trouser%'  OR cj_category_name ILIKE '%jeans%'    THEN 'Pantalons'
    WHEN cj_category_name ILIKE '%jacket%'    OR cj_category_name ILIKE '%coat%'     OR cj_category_name ILIKE '%blazer%'   THEN 'Vestes'
    WHEN cj_category_name ILIKE '%dress%'     OR cj_category_name ILIKE '%skirt%'    OR cj_category_name ILIKE '%robe%'     THEN 'Robes & Jupes'
    WHEN (cj_category_name ILIKE '%top%' AND (cj_category_name ILIKE '%women%' OR cj_category_name ILIKE '%female%'))       THEN 'Tops'
    WHEN cj_category_name ILIKE '%lingerie%'  OR cj_category_name ILIKE '% bra%'     OR cj_category_name ILIKE '%underwear%' THEN 'Lingerie'
    WHEN cj_category_name ILIKE '%perfume%'   OR cj_category_name ILIKE '%fragrance%' OR cj_category_name ILIKE '%cologne%' THEN 'Parfums'
    WHEN cj_category_name ILIKE '%serum%'     OR cj_category_name ILIKE '%moisturizer%' OR cj_category_name ILIKE '%facial%' THEN 'Soins Visage'
    WHEN cj_category_name ILIKE '%hair%'      OR cj_category_name ILIKE '%shampoo%'                                         THEN 'Soins Cheveux'
    WHEN cj_category_name ILIKE '%makeup%'    OR cj_category_name ILIKE '%cosmetic%'  OR cj_category_name ILIKE '%lipstick%' THEN 'Maquillage'
    WHEN cj_category_name ILIKE '%watch%'     OR cj_category_name ILIKE '%smartwatch%'                                      THEN 'Montres'
    WHEN cj_category_name ILIKE '%jewelry%'   OR cj_category_name ILIKE '%necklace%'  OR cj_category_name ILIKE '%bracelet%'
      OR cj_category_name ILIKE '%ring%'      OR cj_category_name ILIKE '%earring%'                                         THEN 'Bijoux'
    WHEN cj_category_name ILIKE '%bag%'       OR cj_category_name ILIKE '%purse%'     OR cj_category_name ILIKE '%backpack%' THEN 'Sacs'
    WHEN cj_category_name ILIKE '%wallet%'    OR cj_category_name ILIKE '%card holder%'                                     THEN 'Portefeuilles'
    WHEN cj_category_name ILIKE '%sunglasses%' OR cj_category_name ILIKE '%eyewear%'                                        THEN 'Lunettes'
    WHEN cj_category_name ILIKE '%belt%'      OR cj_category_name ILIKE '%ceinture%'                                        THEN 'Ceintures'
    WHEN cj_category_name ILIKE '%cap%'       OR cj_category_name ILIKE '%hat%'       OR cj_category_name ILIKE '%beanie%'  THEN 'Chapeaux'
    ELSE NULL
  END
WHERE cj_category_name IS NOT NULL;

-- Index for fast subcategory filtering
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
CREATE INDEX IF NOT EXISTS idx_products_type_created ON products(type, created_at DESC);
