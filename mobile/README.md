# Buyticle Store — l'application

`com.buyticle.btlmarketplace` · Expo SDK 52 · projet EAS
[`@onedev237/buyticle-store`](https://expo.dev/accounts/onedev237/projects/buyticle-store)

## Pourquoi une application native

Tout ce que fait cette application existe déjà dans le navigateur, sauf une
chose : **une notification qui sonne dans la poche d'un commerçant occupé.**

Il a trente secondes pour répondre à un appel à disponibilité, et le taux de
réponse à trente secondes est — chapitre 7 de la stratégie — le paramètre qui
décide de la couverture du rayon. Une notification web sur un Android
d'occasion arrive quand elle arrive ; une notification native arrive. C'est la
seule raison technique d'être de ce dossier, et elle suffit.

## Ce qu'elle fait

| Écran | Pour qui | Ce qu'il porte |
|---|---|---|
| `connexion` | tout le monde | numéro **ou** e-mail — beaucoup ne savent plus lequel |
| `comptoir` | les boutiques | répondre · envoyer · recevoir · journal |
| `relais` | les clients | l'article, le chemin, le code, le paiement |
| `reglages` | tout le monde | version, notifications, déconnexion |

Aucune règle métier ne vit ici. Le barème, l'arbitrage, les douze états : tout
est dans PostgreSQL, et c'est ce qui garantit que le comptoir sur Android et le
comptoir dans un navigateur ne peuvent pas diverger.

## Les mises à jour à l'air (OTA)

Elles comptent plus ici qu'ailleurs : l'application vit sur le téléphone d'un
commerçant de Mboppi qui ne rouvrira pas le Play Store. Une correction poussée
par magasin met des jours à se répandre et suppose qu'il l'accepte. Une mise à
jour à l'air arrive au démarrage suivant.

La règle de prudence est stricte, et elle est dans `lib/maj.js` : **on ne
recharge jamais l'application au milieu de quelque chose.** On télécharge en
silence, et on propose par un bandeau. Recharger pendant qu'un client attend au
comptoir lui ferait perdre la vente et lui apprendrait à se méfier.

```bash
# Publier une correction — elle arrive sans passer par le Play Store
npx eas-cli update --branch production --message "ce que ça corrige"
```

`runtimeVersion` suit `appVersion` : une mise à jour à l'air ne peut atteindre
que les installations de la **même version d'application**. Dès que du code
natif change — une dépendance Expo ajoutée, une permission —, il faut monter
`version` dans `app.json` et refaire un vrai build. Une OTA ne remplace jamais
un build natif, elle ne remplace que du JavaScript.

## Poser le jeton EAS

Le jeton ne va **ni dans ce dépôt, ni dans un fichier, ni dans une commande
qu'on partage.** Sur la machine qui publie :

```bash
export EXPO_TOKEN="<le jeton>"     # ou `npx eas-cli login`
```

En intégration continue, c'est un secret du dépôt (`EXPO_TOKEN`), jamais une
valeur en clair dans un fichier de workflow. Un jeton qui a circulé dans une
conversation, un courriel ou un ticket doit être révoqué et refait sur
https://expo.dev/settings/access-tokens.

## Les clés Supabase

Elles ne sont pas secrètes — la clé anon est déjà lisible dans le bundle du
site — mais elles n'ont rien à faire en dur dans le code.

```bash
# .env.local, jamais versionné
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Pour les builds EAS, les mêmes valeurs en variables d'environnement du projet
(`eas env:create`), sur les trois profils.

## Démarrer

```bash
cd mobile
npm install
npx expo start                     # développement
npx eas-cli build -p android --profile preview     # un APK à installer
npx eas-cli build -p android --profile production  # l'AAB du Play Store
```

## Ce qui reste à faire

- **L'icône et l'écran de démarrage.** `app.json` ne déclare qu'une couleur de
  fond ; il faut y déposer les images.
- **Le paiement ouvre l'USSD, pas la page web.** `pousserUssd` renvoie une
  `payment_url` que l'application ignore : sur mobile, la poussée USSD suffit
  presque toujours. Si un opérateur ne pousse rien, il n'y a pas de recours.
- **La carte du chemin.** Le web affiche un plan ; ici on renvoie vers une
  application externe, exactement ce qu'on a retiré du web. Un `react-native-maps`
  le corrigerait.
- **Le mode hors ligne**, qui manque aussi au web : valider un code sans
  serveur, garder son catalogue sur le téléphone.
