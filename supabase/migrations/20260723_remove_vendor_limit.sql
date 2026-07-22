-- ════════════════════════════════════════════════════════════════════════════
-- Supprime la limite de 5 vendeurs (trigger + fonction de l'ancien schéma)
-- ════════════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS limit_vendors ON public.vendors;
DROP FUNCTION IF EXISTS public.check_vendor_limit();
