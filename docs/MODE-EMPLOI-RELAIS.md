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
| 5 | `docs/sql/27-console-rayons.sql` | les fonctions `admin_*` de la console des rayons |
| 6 | `docs/sql/28-notifications-relais.sql` | `relais_notifications`, ses déclencheurs et la file d'envoi |
| 7 | `docs/sql/29-repondre-a-l-appel.sql` | `appels_en_attente`, le ciblage unifié, et la correction de `lancer_appel` |
| 8 | `docs/sql/30-modifier-rayons.sql` | modifier un rayon ou un sous-rayon, et les supprimer |
| 9 | `docs/sql/31-premier-rayon.sql` | les catégories de recrutement, et le premier rayon monté en entier |

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

Et la fonction edge `relais-notify`, **chaque minute** :

```bash
supabase functions deploy relais-notify
```

Elle vide la file des notifications et pousse vers Firebase. L'application
l'invoque déjà elle-même juste après chaque appel à disponibilité, pour que
les trente secondes commencent tout de suite ; la tâche planifiée rattrape
tout le reste — la vente confirmée, le bon expiré.

Elle a besoin des mêmes secrets que `send-notification` :
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`.

### Et la clé VAPID, côté navigateur

Les trois secrets ci-dessus servent à **envoyer**. Il en faut un quatrième pour
**recevoir**, et il vit dans le front :

```
VITE_FIREBASE_VAPID_KEY=…
```

Console Firebase → Paramètres du projet → Cloud Messaging → « Certificats push
Web » → paire de clés. À poser dans `.env.local` et dans les variables Vercel.

Sans elle, `requestNotificationPermission` s'arrête avant d'obtenir un jeton,
`fcm_tokens` reste vide, et la fonction edge tourne dans le vide sans erreur —
elle vide la file et ne pousse rien. Pour vérifier :

```sql
select count(*) from public.fcm_tokens;                    -- doit être > 0
select genre, count(*), count(envoyee_le)
  from public.relais_notifications group by genre;         -- la file se remplit-elle ?
```

---

## 2. Monter un rayon

La migration `31` monte déjà le premier — **Chaussure & Sport, marché de
Mboppi** — avec ses 5 familles, ses 10 catégories de recrutement et le lien
entre les deux. Il ne reste qu'à y affecter des boutiques.

**Super admin → Rayons.** Tout le reste s'y fait sans écrire une requête :
créer un rayon, ajouter des sous-rayons et des catégories, affecter les
boutiques, les changer de rayon, les retirer.

### Catégorie de recrutement et famille : deux comptes différents

C'est la confusion qui coûte le plus cher, alors la console les sépare.

La **catégorie** est ce sur quoi on cherche le commerçant, et ce dans quoi il
se reconnaît : « chaussure femme », « basket et sneaker ». Les quotas des dix
catégories s'additionnent à 14 — c'est le total du rayon, et la liste de
courses de l'équipe terrain. Chaque ligne affiche `pourvues/quota`.

La **famille** est ce qu'il tient réellement en rayon, souvent trois ou quatre.
Elle sert à calculer la couverture. Les porteurs de toutes les familles
s'additionnent bien au-delà de 14, et c'est normal : douze porteurs de
chaussures dans un rayon de quatorze boutiques n'est pas une contradiction, le
vendeur de baskets en vend aussi.

Chaque catégorie porte les familles qu'une boutique de ce type tient
d'habitude. Quand on affecte une boutique, il suffit de cliquer la catégorie :
le profil, le tarif et les familles sont cochés d'avance. **C'est une
suggestion, pas une contrainte** — l'équipe terrain corrige d'après ce qu'elle
a vu sur l'étagère, et si la boutique tient quelque chose que le rayon ne
connaît pas encore, « + Elle tient autre chose » crée la famille sans fermer
la fiche.

La carte est en haut parce que c'est elle qui tranche : deux boutiques à huit
cents mètres l'une de l'autre ne forment pas un rayon, quels que soient leurs
produits. Le cercle est le périmètre de marche autour du barycentre des
boutiques ; celles qui en sortent apparaissent en rouge, celles qui n'ont pas
de position sont signalées — sans point sur la carte, aucun chemin ne peut
être tracé vers elles.

Le bouton **Ouvrir le rayon** n'apparaît que quand toutes les familles
motrices ont leurs porteurs et que le plancher de huit boutiques est atteint.
La base refuse l'ouverture autrement, et ce n'est pas de la prudence : avant
ce seuil un relais sur deux échoue, et un commerçant qui se plante deux fois
n'utilise plus jamais le mécanisme.

Retirer une boutique la **désactive**, ça ne l'efface pas : ses relais et ses
compteurs restent, sinon le score des autres boutiques deviendrait faux
rétroactivement.

**Modifier.** « Modifier le rayon » ouvre le nom, la zone, la ville, le
périmètre, le plancher d'arbitrage et les bornes du nombre de boutiques. Chaque
sous-rayon a son propre « Modifier », et le formulaire montre l'effet avant de
valider : changer le nombre de variantes recalcule les porteurs nécessaires, et
la ligne dit si la famille restera ouverte ou se fermera. Le nombre de variantes
est la seule donnée saisie du modèle — le corriger après le comptage sur le
terrain est le geste normal, pas l'exception.

Un rayon actif se **suspend** plutôt qu'il ne se supprime, et la base refuse la
suppression dès qu'il a des boutiques ou un seul relais dans son histoire.

<details>
<summary>La même chose en SQL, si besoin</summary>

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
</details>

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

**Tableau de bord → Le relais**, quatre onglets.

**Envoyer un client.** Il tape ce que le client cherche. Son propre stock
s'affiche en premier — c'est son métier, et il récupère les deux tiers des
ruptures par sa propre substitution. S'il ne peut vraiment pas servir, il
appuie sur « Demander au rayon ». Trente secondes plus tard il voit deux ou
trois boutiques classées, la première étant celle qui a le plus donné. Il ne
choisit pas ; s'il s'écarte du classement, il doit dire pourquoi.

**Répondre à un appel.** Quand une boutique du rayon cherche quelque chose, un
encadré orange apparaît en haut de l'écran, quel que soit l'onglet ouvert, avec
un compte à rebours. Sur un appel fermé — l'article est à son catalogue — il a
sa fiche, son prix net et deux boutons. Sur un appel ouvert, il saisit l'article
et son prix net s'il l'a : c'est ce moment-là, et pas un autre, qui construit le
catalogue du rayon.

L'écran interroge la base toutes les trois secondes en plus de la notification
poussée. Un commerçant dont le navigateur refuse les notifications doit pouvoir
répondre quand même, sinon on perd sa couverture — et un bandeau le lui dit.

**Un client arrive.** Il tape les six caractères du client. L'écran lui montre
ce que le client vient chercher, le prix affiché, la remise, ce qu'il paie —
et lui rappelle qu'on ne prend rien sur ce client-là. Un bouton « Je ne l'ai
plus » si l'article vient de partir.

**À livrer.** Le second type de relais. Une cliente est assise dans un fauteuil
de salon, à moitié coiffée, et il manque une longueur de mèche : elle ne peut
pas se lever. Le salon coche « on lui apporte » au lieu de « il y va à pied »,
et c'est la boutique qui vend qui porte — jamais l'envoyeur, qui ne quitte
pas son comptoir. La cliente paie elle-même dans l'application : si le salon
payait et refacturait, il deviendrait revendeur et le modèle du prix net
s'effondrerait. Au-delà de vingt minutes annoncées, la boutique n'est pas
proposée, même si l'arbitrage la désigne.

Le choix du mode n'apparaît que pour un commerçant de services — c'est le seul
qui a un client immobilisé.

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

## 7. Les notifications

Quatre moments, et pas un de plus. Écrits par déclencheur en base, jamais
depuis le navigateur : une notification qui dépend d'un client connecté est
une notification qui n'arrive pas.

| Moment | À qui | Ce qu'elle dit |
|---|---|---|
| `appel` | aux boutiques interrogées | « Tu as encore ça ? — réponds en 30 secondes » |
| `arrive` | à la boutique qui reçoit | « Un client arrive, envoyé par X » |
| `vendu` | à celle qui a envoyé | « + 2 400 F pour toi » |
| `pas_venu` | à celle qui a envoyé | sans reproche : elle a fait son travail |

La troisième est la seule qui compte vraiment : c'est la boucle de
renforcement, celle qui le fait recommencer demain. Un commerçant qui envoie
un client et n'entend plus jamais parler de rien ne recommencera pas.

On ne notifie ni la rupture ni l'annulation : le commerçant n'a rien à en
faire sur le moment, et une notification qu'on ne peut pas traiter apprend à
ignorer les suivantes. Pour la même raison, une notification d'appel de plus
de deux minutes n'est plus poussée du tout.

---

## 8. Ce qui n'est pas encore construit

- **Le repli SMS de l'appel** après dix secondes sans accusé de réception.
- **Les trois compteurs anti-collusion** : la part des relais partant vers une
  même boutique, la part hors classement, le taux de transformation. Les
  données sont là (`rang_propose`, `rang_choisi`, `motif_ecart`), la
  surveillance ne l'est pas.
- **L'abonnement à deux niveaux** et sa déduction sur la commission nette.

---

## 9. Les deux choses à mesurer avant de recruter

**La marge de négociation à l'étal.** Cinq achats, une semaine, en négociant
normalement. On note le prix annoncé et le prix payé. Si un client obtient
couramment le prix net en négociant cinq minutes, il paiera 8 % de trop chez
nous, il s'en apercevra au deuxième achat, et il n'y aura pas de deuxième
achat. C'est l'hypothèse dont tout dépend.

**Le nombre de variantes par famille.** Une heure de comptage par famille.
C'est la seule entrée de la formule qui donne tous les nombres de boutiques ;
si le coefficient réel est de 1,8 au lieu de 2,2, la chaussure passe de douze
à quinze porteurs et le rayon vêtement devient infaisable dans un seul marché.
