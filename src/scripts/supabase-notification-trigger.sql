-- TRIGGER AUTOMATIQUE POUR LES NOTIFICATIONS DE NOUVELLES COMMANDES
-- À exécuter dans Supabase SQL Editor après avoir déployé la fonction Edge

-- 1. Créer une fonction qui sera appelée par le trigger
CREATE OR REPLACE FUNCTION notify_vendor_new_order()
RETURNS TRIGGER AS $$
DECLARE
  vendor_uuid UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Récupérer le vendor_id (si vous avez une logique pour l'assigner)
  -- Pour l'instant, on va notifier tous les vendeurs actifs
  -- Vous pouvez modifier cette logique selon vos besoins
  
  notification_title := 'Nouvelle Commande Elite';
  notification_body := 'Commande #' || NEW.order_number || ' de ' || NEW.client_name || ' - ' || NEW.total_amount || ' FCFA';
  
  -- Appeler la fonction Edge pour chaque vendeur actif
  FOR vendor_uuid IN 
    SELECT id FROM vendors WHERE is_active = true
  LOOP
    -- Utiliser Supabase Edge Function via HTTP
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
      ),
      body := jsonb_build_object(
        'vendorId', vendor_uuid,
        'title', notification_title,
        'body', notification_body
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Créer le trigger sur la table orders
CREATE TRIGGER on_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_vendor_new_order();

-- ALTERNATIVE SIMPLE (sans fonction Edge, juste pour le développement)
-- Cette version ne nécessite pas la fonction Edge mais ne peut pas envoyer de vraies notifications
-- Elle crée juste une entrée dans une table de logs

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION queue_vendor_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Ajouter une notification dans la queue pour chaque vendeur
  INSERT INTO notification_queue (vendor_id, title, body)
  SELECT 
    id,
    'Nouvelle Commande Elite',
    'Commande #' || NEW.order_number || ' de ' || NEW.client_name || ' - ' || NEW.total_amount || ' FCFA'
  FROM vendors
  WHERE is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS on_order_created ON orders;

CREATE TRIGGER on_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION queue_vendor_notification();

-- Pour lire les notifications non envoyées (à utiliser dans votre app)
-- SELECT * FROM notification_queue WHERE sent = false ORDER BY created_at DESC;

-- Pour marquer comme envoyée
-- UPDATE notification_queue SET sent = true WHERE id = 'uuid';
