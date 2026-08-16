# Le Relais — mode d'emploi

Ce que contient le code, dans quel ordre l'appliquer, et comment le faire
tourner. Le raisonnement est dans les six documents de `docs/` ; ici il n'y a
que des gestes.

---

## 1. Appliquer les migrations

Dans l'éditeur SQL de Supabase, dans cet ordre. Chaque fichier est idempotent :
on peut le rejouer sans dommage, et l'ordre entre eux n'a d'importance que
pour la lisibilité — les fonctions qui dépendent d'une table créée plus loin
sont écrites en `plpgsql` exprès.

| | Fichier | Ce qu'il crée |
|---|---|---|
| 1 | `docs/sql/23-rayons.sql` | `rayons`, `familles`, `boutique_rayon`, `boutique_famille`, le barème dans `platform_policy`, et les fonctions de prix |
| 2 | `docs/sql/24-appel-et-arbitrage.sql` | `demandes`, `appels`, `reponses`, le classement d'arbitrage, la recherche |
| 3 | `docs/sql/25-relais.sql` | `relais` et ses douze états, le code à six caractères |
| 4 | `docs/sql/26-bon-et-paiement.sql` | `bon_mouvements`, la commande au comptoir, le relevé de boutique |

Vérification après application :

```sql
select nom, statut from public.rayons;
select * from public.platform_policy;      -- 1300 / 300 / 500 / 500
select public.famille_porteurs_requis(120); -- 12, comme la chaussure
```

### Deux tâches planifiées

À créer dans Supabase (`pg_cron`, ou n'importe quel ordonnanceur) :

```sql
select public.expirer_relais();       -- toutes les heures  · les bons de 48 h
select public.relais_a_confirmer();   -- toutes les heures  · le client debout
                                      --   dans la boutique qui a payé sans
                                      --   confirmer, 2 h plus tard
```

---

## 2. Monter un rayon

Il n'y a pas d'écran d'administration : la composition d'un rayon se décide au
bureau, avec le document 2 sous les yeux. Trois requêtes.

```sql
-- Le rayon
insert into public.rayons (nom, zone, ville, statut)
values ('Chaussure & Sport', 'Marché Mboppi', 'Douala', 'construction')
returning id;

-- Les familles, avec leur nombre de variantes. C'est la seule donnée à
-- mesurer : une heure de comptage dans une boutique de chaque famille.
insert into public.familles (rayon_id, nom, variantes, role) values
  ('<rayon>', 'Chaussures',                120, 'moteur'),
  ('<rayon>', 'Baskets',                    80, 'moteur'),
  ('<rayon>', 'Maillots',                   40, 'appoint'),
  ('<rayon>', 'Chaussettes, lacets, sacs',  12, 'appoint'),
  ('<rayon>', 'Cirage et entretien',         6, 'service');

-- Une boutique entre dans le rayon, et on déclare ce qu'elle tient réellement
insert into public.boutique_rayon (vendor_id, rayon_id, categorie, profil, genre)
values ('<vendor>', '<rayon>', 'Chaussure généraliste', 'emettrice', 'produit');

insert into public.boutique_famille (vendor_id, famille_id)
select '<vendor>', id from public.familles
 where rayon_id = '<rayon>' and nom in ('Chaussures', 'Baskets', 'Maillots');

select public.rafraichir_familles('<rayon>');
```

Puis on regarde où on en est :

```sql
select * from public.rayon_etat('<rayon>');
```

| famille | porteurs | requis | manque | ouverte |
|---|---:|---:|---:|:---:|
| Chaussures | 7 | 12 | **5** | non |
| Baskets | 6 | 10 | 4 | non |
| … | | | | |

**Le rayon ne s'ouvre pas quand la première boutique signe.** Il s'ouvre quand
la famille motrice atteint ses porteurs. Avant, chaque relais tenté a une
chance sur deux d'échouer, et un commerçant qui se plante deux fois n'utilise
plus jamais le mécanisme. Quand la colonne `manque` est à zéro sur la famille
motrice :

```sql
update public.rayons set statut = 'actif', ouvert_le = current_date
 where id = '<rayon>';
```

À partir de cet instant, et pas avant, les prix des boutiques du rayon
s'affichent majorés et l'onglet « Le relais » s'active dans leur tableau de
bord.

---

## 3. Ce que voit le commerçant

**Tableau de bord → Le relais**, trois onglets.

**Envoyer un client.** Il tape ce que le client cherche. Son propre stock
s'affiche en premier — c'est son métier, et il récupère les deux tiers des
ruptures par sa propre substitution. S'il ne peut vraiment pas servir, il
appuie sur « Demander au rayon ». Trente secondes plus tard il voit deux ou
trois boutiques classées, la première étant celle qui a le plus donné. Il ne
choisit pas ; s'il s'écarte du classement, il doit dire pourquoi.

**Un client arrive.** Il tape les six caractères du client. L'écran lui montre
ce que le client vient chercher, le prix affiché, la remise, ce qu'il paie —
et lui rappelle qu'on ne prend rien sur ce client-là. Un bouton « Je ne l'ai
plus » si l'article vient de partir.

**Mes relais.** Le solde de son bon, ce qu'il a gagné dans le mois, ce qui est
retirable, et la liste de ce qu'il a envoyé et reçu.

### Le formulaire produit

Pour une boutique en rayon, le champ prix devient **« Ton prix net »**, et un
encart vert affiche en direct, pendant qu'il tape : ce qu'il touche en entier,
le prix affiché sur Buyticle, ce que son client relayé paiera, et où vont les
13 %.

Cet encart n'est pas décoratif. Le premier commerçant qui découvre 54 240 F là
où il a tapé 48 000 pensera qu'on gonfle ses prix, et il le dira dans l'allée.

---

## 4. Ce que voit le client

**L'affiche du comptoir.** Un autocollant portant l'URL `buyticle.cm/r/<code>`
où `<code>` est le `referral_code` de la boutique. Il le scanne avec son
appareil photo — aucune application à installer.

**Deux gestes.** Son numéro, un mot de passe. Pas de code SMS, pas de
vérification, pas d'adresse e-mail. Son numéro se vérifie tout seul au
paiement : on ne paie pas en Mobile Money avec le numéro d'un autre.

**Mon relais** (`/mon-relais`). Le produit, le prix barré, sa remise, ce qu'il
paie, le temps qu'il lui reste, trois étapes de chemin, et son code en très
grand. Puis « Payer », puis « J'ai mon article ».

**L'avis arrive plus tard**, par notification, sur une commande livrée. Jamais
au comptoir : un avis écrit sous le regard du commerçant n'est pas un avis,
c'est une politesse.

---

## 5. Simuler le circuit

```bash
node docs/simulation-circuit.mjs
```

Rejoue un relais complet avec les règles du SQL, montre l'arbitrage, la
décomposition du prix, le mouvement d'argent, et chronomètre chaque geste.

---

## 6. Le chrono d'un circuit complet

| Acteur | Temps | Ce que c'est |
|---|---:|---|
| **Le vendeur qui envoie** | **30 s** | de « je n'ai pas ta pointure » au client qui part |
| Le commerçant qui reçoit | 46 s | dont 40 s de vente ordinaire, qu'il aurait faites de toute façon |
| Le client | 3 min 59 | dont 1 min 40 de marche et 45 s d'avis, plus tard |
| Le rayon | 30 s | l'attente de l'appel, pendant laquelle personne ne travaille |
| **Le circuit complet** | **5 min 45** | de la question du client à son avis |
| Sans l'avis | 5 min 00 | jusqu'à l'article en main |

Les trente secondes du vendeur sont le seul chiffre qui décide de l'adoption.
Au-delà d'une minute, il ne le fera pas devant un client qui attend — et tout
le reste du modèle en dépend.

---

## 7. Ce qui n'est pas encore construit

- **Les notifications.** L'envoyeur doit être prévenu à la minute où la vente
  se fait, avec le montant de son bon. C'est la boucle de renforcement, et
  c'est elle qui le fait recommencer demain. Le socle existe
  (`send-notification`, `fcm_tokens`) ; le branchement reste à faire.
- **Le repli SMS de l'appel** après dix secondes sans accusé de réception.
- **Le relais livré** pour les commerçants de services : la colonne `mode`
  existe et les prix se calculent, mais l'écran de livraison n'est pas fait.
- **Les trois compteurs anti-collusion** : la part des relais partant vers une
  même boutique, la part hors classement, le taux de transformation. Les
  données sont là (`rang_propose`, `rang_choisi`, `motif_ecart`), la
  surveillance ne l'est pas.
- **L'abonnement à deux niveaux** et sa déduction sur la commission nette.

---

## 8. Les deux choses à mesurer avant de recruter

**La marge de négociation à l'étal.** Cinq achats, une semaine, en négociant
normalement. On note le prix annoncé et le prix payé. Si un client obtient
couramment le prix net en négociant cinq minutes, il paiera 8 % de trop chez
nous, il s'en apercevra au deuxième achat, et il n'y aura pas de deuxième
achat. C'est l'hypothèse dont tout dépend.

**Le nombre de variantes par famille.** Une heure de comptage par famille.
C'est la seule entrée de la formule qui donne tous les nombres de boutiques ;
si le coefficient réel est de 1,8 au lieu de 2,2, la chaussure passe de douze
à quinze porteurs et le rayon vêtement devient infaisable dans un seul marché.
