-- Verrou court : en cas de table occupée, on échoue vite au lieu de bloquer.
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
       AND p.proname IN ('decrement_stock_on_order_item', 'restock_on_order_cancel')
  LOOP
    -- CASCADE : ces fonctions portent des triggers, que le fichier recrée plus bas.
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$reset$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_qty INTEGER;

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
       SET stock_qty = GREATEST(stock_qty - NEW.quantity, 0)
     WHERE id = NEW.product_id
       AND stock_qty IS NOT NULL
       AND stock_qty >= 0;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- Le déclencheur n'a de sens que si order_items référence bien le produit.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'order_items'
               AND column_name = 'product_id') THEN
    DROP TRIGGER IF EXISTS trg_decrement_stock ON public.order_items;
    CREATE TRIGGER trg_decrement_stock
      AFTER INSERT ON public.order_items
      FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_order_item();
  ELSE
    RAISE WARNING 'order_items.product_id absent — décrément de stock non activé.';
  END IF;
END $$;

-- Restitution quand une commande est annulée.
CREATE OR REPLACE FUNCTION public.restock_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    UPDATE public.products p
       SET stock_qty = p.stock_qty + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id
       AND p.id = oi.product_id
       AND p.stock_qty IS NOT NULL
       AND p.stock_qty >= 0;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'order_items'
               AND column_name = 'product_id') THEN
    DROP TRIGGER IF EXISTS trg_restock_cancel ON public.orders;
    CREATE TRIGGER trg_restock_cancel
      AFTER UPDATE OF status ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.restock_on_order_cancel();
  END IF;
END $$;
