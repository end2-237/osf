# Live Shopping — mise en place de l'infrastructure vidéo

Le live (chat, enchères, achat, follow, favoris, vues réelles) fonctionne **sans
vidéo** dès que la migration SQL est appliquée. Pour la **vidéo temps réel**
(le vendeur diffuse sa caméra, les spectateurs regardent en < 1 s de latence),
on utilise **LiveKit** (WebRTC). Voici les 4 étapes.

## 1. Base de données

Exécute la migration dans le SQL Editor Supabase :

- `supabase/migrations/20260721_live_shopping.sql`

Elle crée les tables (`live_shows`, `live_products`, `live_bids`,
`live_messages`, `follows`, `live_saves`), les RPC `place_live_bid` /
`buy_live_product`, active Realtime et crée le bucket `live-media`.

## 2. Compte LiveKit

1. Crée un projet sur https://cloud.livekit.io (offre gratuite généreuse) —
   ou auto-héberge le serveur LiveKit.
2. Récupère : **API Key**, **API Secret**, et l'**URL WebSocket** du projet
   (`wss://<ton-projet>.livekit.cloud`).

## 3. Secrets + déploiement de l'Edge Function

L'Edge Function `livekit-token` signe les jetons (le secret ne quitte jamais le
serveur ; seul l'hôte du show peut diffuser).

```bash
# secrets (jamais commités)
supabase secrets set LIVEKIT_API_KEY=xxxxx
supabase secrets set LIVEKIT_API_SECRET=xxxxx
supabase secrets set LIVEKIT_URL=wss://ton-projet.livekit.cloud

# déploiement
supabase functions deploy livekit-token
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà injectés par Supabase.

## 4. Variable front

Dans `.env.local` (et chez ton hébergeur front) :

```
VITE_LIVEKIT_URL=wss://ton-projet.livekit.cloud
```

Sans cette variable, l'app reste 100 % fonctionnelle mais affiche l'image de
couverture à la place du flux vidéo (repli propre).

---

## Test de bout en bout

1. Connecte-toi en **vendeur** → `/admin` → onglet **Live** → crée un show →
   **Passer en direct** → autorise la caméra. Présente un article.
2. Sur un autre appareil/navigateur, ouvre `/live` → clique le live. Tu vois la
   vidéo, le chat, les enchères et le nombre de vues **en temps réel**.

## Coûts / échelle

- LiveKit Cloud facture à la minute de participant. L'offre gratuite couvre les
  tests ; surveille l'usage en production.
- Latence WebRTC < 1 s (indispensable pour les enchères) — bien meilleur que le
  HLS/RTMP classique (~10–30 s).
