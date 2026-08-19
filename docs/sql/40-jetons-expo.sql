/* ════════════════════════════════════════════════════════════════════════════
   40 — LES JETONS DE L'APPLICATION MOBILE

   `fcm_tokens` ne portait que des jetons de navigateur, tous envoyés de la
   même façon. L'application Android en enregistre d'un second genre, les
   jetons Expo, qui ne s'envoient pas par l'API Firebase mais par celle
   d'Expo. Sans colonne pour les distinguer, l'edge function les pousserait
   vers Firebase, qui les refuserait en silence — et le commerçant qui a
   installé l'application recevrait moins de notifications qu'avant.

   Une colonne, une valeur par défaut qui préserve l'existant, et un index
   d'unicité sur le jeton pour que le même téléphone ne s'inscrive pas deux
   fois à chaque ouverture.
   ════════════════════════════════════════════════════════════════════════════ */

SET lock_timeout = '5s';

ALTER TABLE public.fcm_tokens
  ADD COLUMN IF NOT EXISTS plateforme TEXT NOT NULL DEFAULT 'web';

ALTER TABLE public.fcm_tokens DROP CONSTRAINT IF EXISTS fcm_tokens_plateforme_valide;
ALTER TABLE public.fcm_tokens
  ADD CONSTRAINT fcm_tokens_plateforme_valide
  CHECK (plateforme IN ('web', 'expo'));

-- L'application réenregistre son jeton à chaque ouverture : sans unicité, la
-- table grossit d'une ligne par démarrage et chaque notification part en
-- double, puis en triple.
CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_token_uq ON public.fcm_tokens (token);

CREATE INDEX IF NOT EXISTS fcm_tokens_vendor_idx
  ON public.fcm_tokens (vendor_id, plateforme);

COMMENT ON COLUMN public.fcm_tokens.plateforme IS
  'web : jeton Firebase d''un navigateur. expo : jeton de l''application '
  'Android, à pousser par https://exp.host/--/api/v2/push/send.';
