# Parcours de test — livraison, preuve de remise, retours

Le chemin complet, dans l'ordre où il faut le suivre. Chaque étape dit ce que
tu dois voir : si tu ne le vois pas, c'est là qu'il faut chercher, pas plus
loin.

---

## 0 · Avant tout

**Applique le SQL.** Colle `docs/sql-a-appliquer.sql` d'un bloc dans
Supabase → SQL Editor → Run. Il est rejouable : même si tu l'as déjà passé en
partie, recolle-le en entier, il remet tout d'aplomb.

**Tu as besoin de deux comptes**, pas un seul. Le client et le vendeur ne
peuvent pas être la même personne pour tester sérieusement : la fenêtre d'avis
et le bouton de retour n'apparaissent qu'à l'acheteur, et la console n'ouvre
qu'au vendeur, au livreur ou à l'admin.

| Compte | Rôle |
|---|---|
| A | super-admin **et** vendeur (celui que tu as déjà) |
| B | client ordinaire — un e-mail de plus suffit |

---

## 1 · Créer un compte livreur

Va sur **`/livreur`**, déconnecté ou avec un troisième compte.

Remplis les trois sections : identité, véhicule, pièces. Le formulaire exige
le **recto de la pièce d'identité** et la **photo du visage** — il refuse
d'envoyer sans. Sur téléphone, le bouton ouvre directement l'appareil photo.

> **Attendu** : écran « Dossier reçu », en attente de vérification.

### Valider le dossier

Connecte-toi en **A**, va sur **`/super-admin` → onglet Livreurs** (il porte
une pastille avec le nombre de dossiers à examiner).

Tu vois les quatre pièces côte à côte, cliquables pour agrandir. Bouton
**Examiner**, puis **Valider ce livreur**.

> **Attendu** : le dossier passe en « Validés », une fiche livreur est créée,
> et le compte peut désormais ouvrir `/delivery`.

Un refus exige un motif — le candidat le lit et peut redéposer son dossier
corrigé.

---

## 2 · Préparer la boutique

Compte **A** → **`/admin` → Réglages → Livraison**.

1. **Place la boutique sur la carte.** Bouton « Ma position », ou déplace
   l'épingle. Sans ça, aucun trajet ne se trace et Buyticle Delivery refuse
   de chiffrer.
2. **Choisis qui livre.** « Je livre moi-même » ou « Buyticle Delivery ».
   Le choix décide de qui encaisse le cash *et* de quels livreurs seront
   proposés ensuite.
3. Si tu livres toi-même, ajoute un livreur dans **Mes livreurs** (juste en
   dessous). Un nom et un numéro suffisent — le compte n'est utile que si le
   livreur veut suivre ses courses lui-même.

> **Piège** : en mode « Buyticle Delivery », seuls les livreurs **Buyticle**
> sont attribuables, et seul l'admin peut le faire. En mode « Je livre
> moi-même », seuls les livreurs **de la boutique**. C'est la base qui
> tranche, pas l'écran.

---

## 3 · Passer une commande, côté client

Compte **B**, connecté.

1. **`/profile` → Adresses → Ajouter.** Utilise le bloc **Ma position** :
   GPS ou épingle déplacée. L'adresse se remplit toute seule.
2. Mets un produit de la boutique au panier et va jusqu'au bout.

> **Attendu en mode Buyticle Delivery** : le panier affiche le détail des
> frais — « ramasse 2,4 km (868 F) + remise 5,1 km (1 320 F) ». Sans position
> enregistrée, il refuse de passer à l'étape paiement et te le dit.

> **Piège** : commande **connecté**. Une commande passée sans compte n'a pas
> de `user_id`, donc ni fenêtre d'avis ni bouton de retour.

---

## 4 · Faire la course

Compte **A** (ou le livreur validé) → **`/delivery`**.

La commande apparaît. Filtre « À traiter » si tu ne la vois pas.

1. **Attribuer** → choisis un livreur, ou « Je démarre moi-même ».
2. **Démarrer** → le navigateur demande ta position. Accepte : l'épingle
   « Ma position » remplace le siège Buyticle, et l'itinéraire passe à trois
   points — où tu es, la boutique, le client.
3. **Colis récupéré** → le premier trajet disparaît de la carte, il est fait.
4. **Terminer** → deux façons, voir ci-dessous.

> **Attendu** : le fil de trois points en haut se remplit à mesure, et un
> seul bouton d'action est proposé à la fois.

---

## 5 · Clore la course — les trois cas

### a) Le client donne son code

C'est le cas normal. Le client trouve ses **4 chiffres** dans
**`/profile` → Retours**, en haut, sur bandeau noir. Il te les lit.

> Le code n'existe qu'**après le démarrage** de la course. Avant, rien à
> afficher — c'est normal.

Saisis-les dans la case à côté du bouton Terminer.

> **Attendu** : preuve = `code`. Le client ne pourra plus dire « jamais reçu ».
> Un mauvais code est refusé.

### b) Le client ne peut pas — téléphone déchargé, voisin, personne absente

Bouton **« Le client ne peut pas donner son code »**. La fiche de remise
s'ouvre :

- nom du réceptionnaire, **type et numéro de pièce d'identité**
- case « ce n'est pas le client » + le lien (voisine, gardien, frère)
- **signature au doigt** + **photo du colis remis**
- ou bascule **Fiche papier** : une seule photo, la fiche signée avec le colis

> **Attendu** : preuve = `slip`. La base refuse si le nom, la pièce ou la
> photo manque — teste-le, elle te le dit sur le pas de la porte.

### c) Ni l'un ni l'autre

Terminer avec la case code vide. Ça passe, mais preuve = `none` : en cas de
litige « jamais reçu », le doute profitera au client.

---

## 6 · Ce que voit le client après

Compte **B**, n'importe quelle page.

> **Attendu tout de suite** : la **fenêtre d'avis** s'ouvre d'elle-même.
> Note la boutique (obligatoire) et les produits (facultatif, laisse sans
> étoile ce que tu ne veux pas noter). « Plus tard » la reporte pour la
> session ; la commande reste notable depuis le profil.

Puis **`/profile` → Retours** :

- **Tout est bon** → confirme la réception. L'argent part immédiatement chez
  le vendeur et le délai se ferme.
- **Retourner** → choisis un motif parmi quatre, explique, envoie. Le compte
  à rebours « retour possible encore 43 h 59 » est affiché.

> **À tester** : demande un retour avec le motif **« Jamais reçu »** sur une
> commande close **avec code**. Refusé, avec un message qui t'oriente vers le
> bon motif. Sur une commande close **sans preuve**, accepté.

---

## 7 · L'argent

Compte **A** → **`/admin` → Réglages → Retraits**.

> **Attendu** : la vente n'est **pas** dans « Disponible ». Elle est dans
> **« En attente de confirmation »**, avec l'encart orange qui explique
> pourquoi. C'est tout le point : marquer « livré » ne paie plus.

Trois façons d'en sortir :

| | |
|---|---|
| Le client confirme | libéré tout de suite |
| 48 h passent | libéré automatiquement |
| Litige ouvert | **gelé** jusqu'à arbitrage |

### Libérer sans attendre, sur preuve

Compte **A** → **`/super-admin` → Litiges**, panneau **Remises à valider** en
bas. Tu vois la fiche dépliée — qui a reçu, quelle pièce, quelles photos, la
position — et le décompte avant libération automatique.

Bouton **« Valider la remise et verser »**.

> **Attendu** : le « Disponible » du vendeur monte immédiatement.

### Arbitrer un litige

Même onglet, panneau du haut. Chaque litige affiche trois faits avant la
décision : **le code a-t-il été saisi**, **combien de litiges ce client a
déjà ouverts**, et **combien ont été jugés infondés**.

- **Donner raison au client** → l'argent reste gelé, à rembourser.
- **Donner raison à la boutique** → libéré aussitôt.

---

## 8 · Les limites de forfait

### Le plafond de vitrine

Compte vendeur → **Dashboard → Produits**. La barre du haut annonce combien de
places sont occupées.

Sur le gratuit (20 places), crée un 21ᵉ produit.

> **Attendu** : il est publié, mais **en réserve** — badge gris sur la carte,
> et la ligne « 1 produit en réserve — modifiable, mais invisible pour les
> clients ». Le vendeur garde son travail ; c'est la vitrine qui est pleine.

Ouvre le menu **⋯** d'un produit en réserve → **Mettre en vitrine**.

> **Attendu** : refusé, avec le nombre de places du forfait. Retire d'abord un
> autre produit (**⋯ → Retirer de la vitrine**), puis réessaie : ça passe.
> C'est le vendeur qui arbitre, pas un tri automatique.

### Les autres plafonds

| Ce qu'on tente | Attendu sur le gratuit |
|---|---|
| Ajouter une 4ᵉ photo à un produit | Le bouton « Ajouter » disparaît à 3 |
| Enregistrer un 2ᵉ livreur | Refusé, message donnant la limite |
| Ouvrir **Statistiques** ou **Passer en live** | Page verrouillée, renvoi vers les forfaits |
| Activer la **remise membre** (Réglages → Paiements) | Badge « Pro », interrupteur retiré |
| Choisir **Buyticle Delivery** (Réglages → Livraison) | Badge « Pro » ; « Je livre moi-même » reste ouvert |

### L'échéance qui passe

Dans Supabase, recule l'échéance d'une boutique Pro :

```sql
UPDATE public.vendors
   SET plan_expires_at = NOW() - INTERVAL '1 day'
 WHERE shop_name = 'Ta Boutique';
```

Recharge le dashboard vendeur.

> **Attendu** : le tableau de bord s'ouvre directement sur **Abonnement**, et
> toutes les autres pages affichent « Ton abonnement a expiré » avec deux
> issues — **renouveler** ou **passer au forfait gratuit**. En parallèle,
> ouvre la page publique de la boutique en navigation privée : elle et ses
> produits ont disparu du site. Rien n'est supprimé — le vendeur, lui, voit
> toujours son catalogue entier.

Clique **Passer au forfait gratuit**.

> **Attendu** : la boutique est en ligne à la seconde. Si le catalogue dépasse
> les 20 places, les produits les moins vendus passent en réserve — et le
> vendeur peut aussitôt échanger l'un contre l'autre depuis la page Produits.

---

## Les pièges, résumés

| Symptôme | Cause |
|---|---|
| Aucun livreur proposé à l'attribution | Mode de livraison et périmètre du livreur ne correspondent pas |
| Pas de code chez le client | La course n'a pas encore été **démarrée** |
| Ni fenêtre d'avis ni bouton retour | Commande passée **sans être connecté** |
| Le panier refuse de continuer | Boutique non placée sur la carte, ou client sans position |
| Trajet non tracé | Boutique ou client sans position — l'écran nomme lequel |
| `/delivery` affiche « Accès réservé » | Compte ni vendeur, ni livreur validé, ni admin |
| Un produit publié n'apparaît pas en boutique | Vitrine pleine : il est en réserve |
| La boutique a disparu du site | Abonnement échu — renouveler, ou repasser au gratuit |
