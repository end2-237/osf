# Le design de l'application mobile

Décomposition de la référence (Airba / Technodom), et ce qu'on en fait.

**La consigne, en une ligne :** rien du design n'est abandonné. On garde chaque
élément, chaque animation, chaque état — on y met notre contenu, et on invente
dans le même style les pages que la référence ne montre pas.

---

## 1. Les jetons

### Couleurs

| Rôle | Valeur | Où |
|---|---|---|
| Marine profond | `#141B4D` | En-tête, boutons principaux, boutons panier ronds, bandeau bonus |
| Orange | `#FF6B00` | Accent, badges de remise, onglet actif, prix promotionnel, sélection |
| Orange clair | `#FF8A3D` | Dégradés de bannière |
| Fond de page | `#F2F1FA` | Lavande très pâle — ce n'est **pas** du blanc |
| Carte | `#FFFFFF` | Toutes les cartes |
| Encre | `#1A1A1A` | Titres |
| Gris texte | `#8A8F98` | Secondaire, prix barré |
| Vert livraison | `#00A651` | « Livré en 2 h » |
| Rouge cœur | `#E53935` | Favori actif |
| Jaune note | `#FFB800` | Étoiles et valeur de note |

Le fond lavande est le détail qu'on rate toujours : il fait ressortir les
cartes blanches sans ombre lourde. Sur blanc, la même page paraît plate.

### Formes et rythme

- Rayon des cartes : **16 px**. Vignettes produit : **12 px**. Puces : **plein**.
- Ombre : `0 2px 12px rgba(20,27,77,.06)` — presque invisible, jamais de gris sale.
- Marge de page : **12 px**. Gouttière de grille : **10 px**.
- Titre de section : 17 px, gras. Lien « все товары › » à droite, orange, 13 px.

### Typographie

| Usage | Taille | Graisse |
|---|---|---|
| Prix principal | 20–22 | 800 |
| Prix barré | 12 | 400, barré, gris |
| Badge remise | 12 | 700, orange |
| Titre produit | 13 | 400, **2 lignes maximum** puis coupe |
| Titre de section | 17 | 700 |
| Note | 13 | 700, jaune |

---

## 2. La carte produit

C'est l'élément le plus réutilisé de toute l'application. Elle a **onze**
emplacements, et aucun n'est décoratif.

```
┌─────────────────────────────┐
│ [badge ↖]          [♡ ↗]    │  ① badge  ② favori
│                             │
│         image               │  ③ image carrée
│        · · · · ·            │  ④ points de pagination
│                             │
│ ⚡ IL EN RESTE 3            │  ⑤ ligne d'urgence
│ Titre du produit sur        │  ⑥ titre, 2 lignes
│ deux lignes au maximum      │
│ 4,8 ★★★★★ (124)             │  ⑦ note
│ [🔶 dès 3 990 F × 12 mois]  │  ⑧ paiement échelonné
│ 299 990 F         ( 🛒 )    │  ⑨ prix   ⑪ bouton panier
│ 318 990  -33%               │  ⑩ prix barré + remise
│ Livré en 2 h                │      ligne verte
│ Retrait : aujourd'hui       │
└─────────────────────────────┘
```

**① Le badge** (haut-gauche) prend une seule valeur, dans cet ordre de
priorité : `SALE` · `NEW` (avec emoji feu) · `Paiement 0-0-24` · `−15 %`.

**⑤ La ligne d'urgence** est ce qui fait la différence entre une grille qui se
parcourt et une grille qui vend : `⚡ Il en reste 3` · `⭐ Meilleur prix` ·
`🔥 Ça part vite` · `⏱ 03:24:56 avant la fin`.

**⑪ Le bouton panier** est un cercle marine de 40 px. Il n'ajoute pas
directement : il **ouvre la feuille de choix** (voir § 5).

Deux dispositions, même carte :
- **verticale** en grille de 2 colonnes ;
- **horizontale** dans les rails « Nouveautés » — image à gauche, texte à
  droite, cœur et panier alignés en bas à droite.

---

## 3. L'accueil, dans l'ordre

C'est la partie que la vidéo détaille le plus, et celle qui manquait le plus
chez nous.

| # | Bloc | Contenu | Notre version |
|---|---|---|---|
| 1 | **En-tête marine** | logo centré, épingle de localisation, champ de recherche, cloche à pastille, casque d'assistance | idem — la cloche mène aux notifications de relais |
| 2 | **Puces de raccourci** | rail horizontal : « casques », « écrans », « portables » avec une icône | les **familles du rayon** du commerçant, ou les catégories vedettes pour un client |
| 3 | **Carrousel de bannières** | défile seul, les voisines dépassent des deux côtés, points en dessous | nos bannières promotionnelles |
| 4 | **Deux cartes de service** | « Programme de service » · « Programme de fidélité » | « Livraison gratuite » · « Programme de fidélité » |
| 5 | **Grille de services** | rail d'icônes rondes colorées avec libellé sur 2 lignes | Ventes flash · Cartes cadeaux · Lives · Livraison express · **Le relais** · Parrainage |
| 6 | **Bloc orange plein** | « Offres avantageuses », rail de cartes sur fond orange | idem |
| 7 | **Catégories populaires** | grille 3 × N, image détourée sur fond blanc, libellé 2 lignes | nos catégories |
| 8 | **Nouveautés et tendances** | cartes **horizontales**, compte à rebours en orange | idem |
| 9 | **Promotions** | rail de bannières larges | idem |
| 10 | **Top produits** | rail de cartes verticales | idem |
| 11 | **Bandeau bonus** | fond marine, mascotte, « Vos bonus vous attendent », bouton orange | **notre bandeau relais** pour un visiteur non connecté |
| 12 | **Ça pourrait te plaire** | grille infinie 2 colonnes, **bannières intercalées** dans la grille | idem, avec les suggestions du relais |

Le bloc 11 est le seul qui change de nature chez nous : la mascotte vend
l'inscription, nous vendons le relais — « Un commerçant n'a pas ce que tu
cherches ? Il t'envoie chez un voisin qui l'a. »

---

## 4. La barre d'onglets

Cinq entrées, fixée en bas, fond blanc, bord supérieur très clair.

| Icône | Libellé | Route |
|---|---|---|
| maison | Accueil | `/` |
| grille 2×2 | Catalogue | `/catalogue` |
| cœur + pastille | Favoris | `/favoris` |
| panier + pastille | Panier | `/panier` |
| personne | Profil | `/profil` |

L'onglet actif est **orange**, icône et libellé. Les pastilles sont des
cercles orange avec un chiffre blanc, posés en haut à droite de l'icône.

Notre comptoir vendeur ne rentre pas dans ces cinq : il s'ouvre depuis le
profil, et la notification d'appel y mène directement.

---

## 5. L'ajout au panier — la feuille de choix

C'est l'interaction la plus travaillée de la vidéo, et elle mérite d'être
copiée geste pour geste.

**Le déroulé**

1. Appui sur le bouton panier rond d'une carte. Un cercle gris d'appui
   apparaît sous le doigt (effet d'onde).
2. Le fond **s'assombrit** progressivement.
3. Une feuille **monte du bas** en ~280 ms, coins supérieurs arrondis à 20 px,
   avec une **poignée** grise de 40 × 4 px centrée.
4. Elle occupe la hauteur nécessaire, jamais l'écran entier : la grille reste
   visible derrière, et c'est ce qui dit qu'on n'a pas quitté la page.

**Ce qu'elle contient**

```
        ────                         ← poignée
┌──────┐  ⭐ MEILLEUR PRIX
│ img  │  Titre du produit sur
│ ···· │  deux lignes maximum
└──────┘  dès 3 990 F × 12 mois
          769 990 F  899 990  −33%

Couleur : Bleu
[img][img][img][img][img]           ← vignettes, bord orange sur la choisie

Mémoire : 256 Go
[128 Go][256 Go][512 Go][1 To]      ← puces, bord orange sur la choisie

┌───────────────────────────────┐
│   🛒  Ajouter au panier        │   ← gris tant qu'il manque un choix
└───────────────────────────────┘
```

**La règle qui compte : le bouton naît désactivé.** Il reste gris clair,
texte gris, tant que toutes les variantes n'ont pas été choisies. Il devient
marine plein dès que c'est fait. On ne laisse jamais quelqu'un ajouter au
panier une déclinaison qu'il n'a pas choisie — c'est la première cause de
retour.

**À la validation :** la feuille redescend, le fond s'éclaircit, et la
**pastille du panier s'incrémente** dans la barre d'onglets. Pas de message de
confirmation : la pastille est la confirmation.

**Chez nous, cette feuille sert deux fois.** Pour ajouter au panier, et —
même forme, même comportement — pour **répondre à un appel à disponibilité** :
« Je l'ai / Je ne l'ai pas » avec la saisie du prix net. Le commerçant a
trente secondes ; une feuille qui monte est plus rapide qu'une page qui
s'ouvre.

---

## 6. Les animations à reproduire

| Où | Quoi | Durée |
|---|---|---|
| Carrousel de bannières | défilement automatique + points | ~4 s par vue |
| Appui sur un bouton | cercle d'onde gris sous le doigt | 200 ms |
| Feuille de choix | montée depuis le bas + assombrissement du fond | 280 ms, sortie |
| Fermeture de la feuille | descente + éclaircissement | 220 ms |
| Pastille du panier | incrément après fermeture | — |
| Choix d'une variante | le bord orange se pose | 120 ms |
| Bouton principal | gris → marine quand il devient actif | 150 ms |
| Grille infinie | chargement à l'approche du bas, sans bouton | — |
| Cœur | bascule en rouge plein | 150 ms |

---

## 7. Ce qu'il faut porter du web

Trente routes existent sur le site. Tout doit exister sur mobile **sauf la
super-administration**.

### Côté client
Accueil · Catalogue et catégories · Recherche (3 états : historique,
suggestions, saisie) · Fiche produit · Panier · Commande et paiement ·
Suivi de commande · Favoris · Boutiques · Fiche boutique · Avis ·
Profil · Fidélité et bonus · Parrainage · Lives · Fiche créateur ·
**Mon relais** (déjà fait) · CGV et pages légales

### Côté vendeur
Tableau de bord · Statistiques · Produits (liste, ajout, modification) ·
Commandes · Clients · **Le relais** (déjà fait) · Retraits et bon ·
Abonnement · Réglages · Livraison · Passer en live

### Côté livreur
Inscription · Console de livraison · Course en cours

### Exclu
`/super-admin` — la console des rayons, les compteurs de collusion,
l'arbitrage. Elle reste sur le web.

### Ce que la référence ne montre pas, et qu'il faut inventer dans son style
Le tableau de bord vendeur, les retraits, l'abonnement, la console livreur,
les lives, le suivi de commande, les pages légales. On y applique les mêmes
jetons : fond lavande, cartes blanches à 16 px, en-tête marine, accent orange,
prix en gras, actions principales en marine plein.

---

## 8. Ce qu'on ne copie pas

La mascotte et le nom de la marque de référence. Les valeurs en tenge et le
russe. Le reste — structure, densité, hiérarchie, animations — se garde tel
quel.
