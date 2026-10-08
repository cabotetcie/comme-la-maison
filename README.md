# Le QG — le quotidien du foyer d’Ilona et Adrien

Application web (téléphone et ordinateur) organisée selon la **méthode TAPP** :

| | Dans l’application |
|---|---|
| **T · Tâche** | Action précise qui demande de la concentration et un temps défini. Elle commence idéalement par un verbe. |
| **A · Action** | Micro-tâche rapide : un type à part, estimé à 5 min. On peut aussi découper une tâche en sous-actions. |
| **P · Projet** | Il n’apparaît jamais dans « Aujourd’hui ». Tant qu’il n’a pas de tâches, il est signalé « À découper en tâches ». |
| **P · Priorité** | Chaque élément reçoit un horizon : *Aujourd’hui*, *Cette semaine* ou *Date précise*. Sinon il va dans *Plus tard*, l’espace dédié. Il garde aussi un niveau : basse, normale, haute ou urgente. |

Pile technique : HTML/CSS/JavaScript sans étape de build, **Supabase** pour la base PostgreSQL, les comptes et la synchronisation en temps réel, et **GitHub Pages** pour l’hébergement.

---

## 1. Créer la base Supabase (≈ 10 min, une seule fois)

1. Allez sur <https://supabase.com> et cliquez **New project**.
   - Nom : `le-qg`
   - Région : *West EU (Paris)*
   - Mot de passe de la base : cliquez *Generate*. Il ne sert pas à l’application.
2. Une fois le projet prêt, ouvrez **SQL Editor** → **New query**.
3. Collez **tout** le contenu de `supabase/schema.sql`, puis cliquez **Run**.
   - Vous devez voir `Success. No rows returned`.
   - Le script peut être relancé sans risque.
4. Ouvrez **Authentication → Sign In / Providers** (ou *Providers* selon la version).
   - Activez **Allow anonymous sign-ins**.
   - Cliquez **Save**.
   - Il n’y a pas de comptes e-mail : chaque appareil reçoit une session anonyme, rattachée à Ilona ou Adrien après la saisie du code du foyer.
5. Ouvrez **Project Settings → API**. Copiez la **Project URL** et la clé **anon public**.
   - Ne prenez **pas** la clé `service_role`.

## 2. Lancer l’application sur votre ordinateur

Prérequis : **Node.js 20 ou plus récent** (<https://nodejs.org>, version LTS). Pour vérifier, tapez `node -v` dans le Terminal.

Ouvrez le **Terminal** (Mac : `Cmd + Espace` → « Terminal ») et tapez ces commandes **une par une** :

```bash
# 1. Aller dans le dossier du projet (adaptez le chemin)
cd ~/Documents/le-qg

# 2. Créer le fichier de configuration privé à partir du modèle
cp .env.example .env

# 3. Ouvrir .env pour y coller vos deux valeurs Supabase
open -e .env
```

Dans le fichier `.env` qui s’ouvre, remplissez les deux lignes **sans espaces ni guillemets**, puis enregistrez avec `Cmd + S` et fermez :

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

Puis, toujours dans le Terminal :

```bash
# 4. Générer js/config.js à partir de .env
npm run config
#    → doit afficher : ✓ js/config.js généré.

# 5. (facultatif) Lancer les tests de la logique
npm test
#    → doit se terminer par : # pass 18  /  # fail 0

# 6. Démarrer le serveur local
npm start
#    → doit afficher : Le QG tourne sur http://localhost:5173
```

Ouvrez <http://localhost:5173> dans votre navigateur. Pour arrêter le serveur, revenez dans le Terminal et faites `Ctrl + C`.

> `.env` et `js/config.js` sont exclus de Git (`.gitignore`) : vos clés ne sont jamais publiées dans le dépôt.

## 3. Mettre en ligne avec GitHub Desktop + GitHub Pages

1. **GitHub Desktop** → *File → Add Local Repository…* → choisissez le dossier `le-qg`.
   - S’il vous propose *create a repository*, acceptez.
   - Nom : `le-qg`.
2. Résumé du commit : `Première version du QG` → **Commit to main** → **Publish repository**.
   - Vous pouvez laisser *Keep this code private* coché.
   - Attention : GitHub Pages sur un dépôt privé demande un compte GitHub payant. Avec un compte gratuit, décochez la case. Le code ne contient aucun secret.
3. Sur github.com, ouvrez le dépôt → **Settings → Secrets and variables → Actions → New repository secret**. Créez deux secrets :
   - `SUPABASE_URL` = votre Project URL
   - `SUPABASE_ANON_KEY` = votre clé anon public
4. **Settings → Pages → Build and deployment → Source : GitHub Actions**.
5. Onglet **Actions** → workflow « Publier Le QG ».
   - S’il n’a pas tourné, cliquez **Run workflow**.
   - Au bout d’environ 1 minute, l’adresse s’affiche : `https://VOTRE-PSEUDO.github.io/le-qg/`.
6. Pour chaque mise à jour, faites un commit puis **Push origin** dans GitHub Desktop. Le site se republie tout seul.

## 4. Premiers pas à deux

1. La toute première fois, l’app affiche **« Première ouverture »**.
   - Choisissez « Je suis Ilona » ou « Je suis Adrien ».
   - Inventez ensemble un **code du foyer** de 4 caractères minimum, puis validez.
   - Le foyer est créé. Le planning ménage, les deux tâches ponctuelles et la liste de courses de départ sont importés **une seule fois**.
2. Sur chaque autre téléphone ou ordinateur, l’app demande **« Qui es-tu ? »**.
   - On choisit son prénom et on tape le code du foyer.
   - C’est à faire **une seule fois par appareil**, l’app s’en souvient ensuite.
3. Sans le code, personne ne peut entrer, même avec l’adresse du site.
   - Le code se change dans **Foyer**.
   - **Foyer → Changer de personne sur cet appareil** permet de « déconnecter » un appareil.
4. Pour installer l’app avec l’icône « comme à la maison » :
   - iPhone : Safari → Partager → *Sur l’écran d’accueil*
   - Android : Chrome → ⋮ → *Ajouter à l’écran d’accueil*
   - Sur iPhone, l’app installée a sa propre mémoire. Il faut donc choisir « Je suis … » une fois dedans, même si c’était déjà fait dans Safari.

## 5. Ce que fait l’application

- **Aujourd’hui** : la date, la progression d’Ilona, d’Adrien et du foyer (« 3 tâches sur 5 terminées »), les priorités du jour, les retards, les tâches de chacun, celles « à répartir », celles de la semaine sans jour fixé, les repas du jour et l’accès aux courses.
- **Ajouter** (bouton rouge toujours visible) : tâche, action rapide, démarche administrative, achat maison, produit de courses, idée de repas ou idée de projet. Seul le titre est obligatoire.
- **À organiser** : la boîte de réception commune. On donne un horizon en un geste, ou on range l’élément dans la bonne rubrique.
- **Maison** : vues Aujourd’hui, Semaine, Par personne, Par projet, Plus tard, Récurrences et À replanifier.
  - Chaque occurrence se valide et se reporte seule.
  - Pour modifier une tâche récurrente, on choisit « Cette occurrence » ou « Toute la série ».
  - Une tâche reportée n’est jamais dupliquée.
- **Disponibilités** : absences (aujourd’hui, certains jours, cette semaine, une période) et disponibilités réduites.
- **Répartition automatique** :
  - Elle équilibre le **temps total estimé** et tient compte des absences, des préférences et des tâches déjà attribuées.
  - Elle conserve les attributions manuelles, sauf si vous demandez « Tout rééquilibrer ».
  - Elle place en « À replanifier » ce que personne ne peut faire.
  - Elle propose de reporter les tâches non urgentes plutôt que de surcharger la personne présente.
  - Elle alterne les tâches récurrentes, explique chaque choix et affiche toujours un aperçu avant d’appliquer.
- **Repas** : menu du lundi au dimanche, avec un dîner par jour, un déjeuner facultatif et l’option « Pas de repas à prévoir ».
  - On peut déplacer ou échanger les repas et reprendre la semaine précédente.
  - La bibliothèque d’idées gère les ingrédients, le temps de préparation et les favoris.
  - L’ajout des ingrédients aux courses passe par une vérification qui tient compte de l’inventaire et fusionne les produits sans mélanger des unités incompatibles.
- **Courses** : ajout rapide (« 2 kg pommes »), classement automatique par catégorie (modifiable), case « Acheté ».
  - Cocher un produit ne touche pas l’inventaire.
  - « Ranger les achats » transfère les produits dans l’inventaire après vérification des quantités.
- **Inventaire** : placards, réfrigérateur, congélateur et emplacements personnalisés.
  - Bouton « − » pour diminuer le stock et bouton panier pour ajouter un produit aux courses.
  - Alertes pour les produits périmés ou bientôt périmés et pour les stocks bas.

## 6. Vérifications effectuées

- `npm test` : 18 tests de logique.
  - Fuseau Europe/Paris, y compris le passage à minuit et le changement d’heure.
  - Récurrences, dont « une semaine sur deux ».
  - Validation et report d’occurrence sans doublon.
  - Progression : 3 sur 5, sous-actions ignorées, tâche partagée comptée une fois.
  - Retards.
  - Répartition : absence, deux absents, attribution manuelle, équilibre du temps, report, alternance.
  - Fusion des ingrédients et prise en compte de l’inventaire.
- `tests/db/test_schema.sql` : le schéma a été exécuté **deux fois** sur un vrai PostgreSQL 16.
  - Création du foyer et import initial : 21 tâches et 7 produits, sans doublon à la ré-exécution.
  - Un seul foyer possible ; code du foyer de 4 caractères minimum, jamais lisible.
  - Appareil inconnu : aucune donnée visible ; mauvais code refusé.
  - Ilona sur deux appareils, Adrien sur un autre : mêmes données partagées.
  - Unicité des occurrences ; identité d’un appareil non modifiable directement.
  - Changement de code et retrait d’un appareil.
- `tests/ui/run.py` : parcours complet dans Chromium en taille téléphone (390 px) et ordinateur (1360 px), avec un faux client Supabase réservé aux tests.
  - 16 étapes : première ouverture, « Qui es-tu ? » avec mauvais puis bon code, reconnaissance après rechargement, répartition, progression, capture, report d’occurrence, absence, menus vers courses, rangement des achats, confirmations.
  - Aucun débordement horizontal sur mobile.

Pour relancer le test d’interface : `npm start` dans un terminal, puis `python3 tests/ui/run.py` dans un autre. Il faut Python et Playwright.

## 7. Limites connues

- La synchronisation en temps réel et les sessions d’appareil reposent sur Supabase. Elles fonctionneront une fois l’étape 1 faite.
  - Elles n’ont pas pu être testées ici contre un vrai projet Supabase.
  - La base a été testée sur PostgreSQL et l’interface avec un client simulé.
- Si l’on efface les données du navigateur, l’appareil oublie qui vous êtes : il suffit de refaire « Je suis … » avec le code.
- Pas de notifications push, pas de mode hors ligne : l’application a besoin d’une connexion.
