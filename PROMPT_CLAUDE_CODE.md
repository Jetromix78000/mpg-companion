# MISSION

Passer ce repo GitHub de PUBLIC à PRIVÉ sans interrompre la production, puis vérifier et adapter le déploiement Vercel et Cloudflare déjà en place.

Le code est déjà en production. Toute régression ou coupure est inacceptable.

# CONTEXTE UTILISATEUR (important)

- Je ne sais pas coder. C'est toi, Claude Code, qui lis le code, modifies, commites et pousses pour moi.
- Explique-moi tout en langage simple, sans jargon. Si tu dois employer un terme technique, explique-le en une phrase.
- Quand j'ai une action à faire à la main (sur github.com, vercel.com, dash.cloudflare.com), guide-moi UNE étape par message et attends mon "fait" avant la suivante.
- Mon plan Vercel est HOBBY (gratuit). Mon repo appartient à un compte GitHub PERSONNEL (pas à une organisation).
- Je suis le seul contributeur du repo.

# RÈGLES NON NÉGOCIABLES

1. Tu travailles par PHASES. À la fin de chaque phase, tu résumes en 5 lignes maximum et tu attends mon "OK" explicite avant la suivante.
2. Tu ne fais JAMAIS sans mon accord explicite :
   - `git push --force`, réécriture d'historique, suppression de branche ;
   - suppression ou modification de variables d'environnement, de domaines ou de DNS ;
   - changement de visibilité du repo ;
   - déploiement en production ;
   - modification de la configuration git globale (`--global`).
3. Tu ne modifies JAMAIS la branche de production directement. Tout changement passe par une branche `chore/private-repo-migration`.
4. Tu n'affiches JAMAIS un secret en clair. Tu indiques le fichier, la ligne et le type de secret, valeur masquée (`sk-****`).
5. Si une information manque, tu la DÉTECTES dans le repo, sinon tu me poses UNE question précise. Tu n'inventes rien.
6. Tu distingues toujours ce que tu as VÉRIFIÉ de ce que tu SUPPOSES. Tu listes à part les actions manuelles que je dois faire dans une interface web.
7. Tu présentes un diff avant toute modification de fichier, et tu attends mon OK.

# PHASE 0 : AUDIT EN LECTURE SEULE (aucune modification)

Analyse et donne-moi un rapport :
1. Le framework, le gestionnaire de paquets et le build (`package.json`, `vercel.json`, `wrangler.toml`, `wrangler.jsonc`, `.github/workflows/*`, `next.config.*`, `astro.config.*`, etc.).
2. Le rôle exact de chaque service :
   - Vercel : repo connecté par intégration Git ? Hooks de déploiement ? Variables d'environnement utilisées (noms uniquement) ?
   - Cloudflare : simple DNS/proxy devant Vercel ? Ou aussi Pages, Workers, R2, KV, D1 ? Déployé via Git, `wrangler` ou GitHub Actions ?
3. Les dépendances au caractère public du repo :
   - liens `raw.githubusercontent.com` ou URLs d'images, de badges ou de releases pointant vers ce repo ;
   - packages installés depuis ce repo via `github:user/repo` ;
   - GitHub Pages, git submodules, workflows qui appellent ce repo depuis un autre repo ;
   - liens dans le README, la doc ou le site en production vers le repo.
4. Les GitHub Actions : quels workflows existent, et combien de minutes mensuelles ils consomment à peu près (un repo privé a un quota limité selon le plan).
5. L'état de l'historique git : branches, tags, taille du repo.
6. Les limites du plan Vercel Hobby à risque pour ce projet (minutes de build, bande passante, durée max des fonctions). Dis-moi s'il y a un risque.

# PHASE 1 : AUDIT DES SECRETS

Un repo qui a été public a pu être scanné par des robots. Pars du principe que tout ce qui a été commité dans l'historique a pu être lu ou copié.

1. Cherche dans TOUT l'historique, pas seulement dans l'état actuel : `.env*`, clés API, tokens, mots de passe, clés privées, URLs de base de données, webhooks, tokens Cloudflare, Vercel ou GitHub. Utilise `git log -p`, `git grep` sur toutes les révisions, et `gitleaks` ou `trufflehog` s'ils sont disponibles sans risque.
2. Donne un tableau : `secret (masqué) | fichier | commit | service concerné | action de rotation`.
3. Règle : rendre le repo privé NE SUFFIT PAS. Tout secret trouvé dans l'historique doit être révoqué et régénéré chez le fournisseur. Ne nettoie pas l'historique tant que je ne l'ai pas demandé. La rotation passe avant le nettoyage.
4. Vérifie que `.gitignore` couvre `.env*`, `.vercel`, `.wrangler`, `node_modules`, et que les secrets actuels vivent uniquement dans les variables d'environnement de Vercel, Cloudflare ou GitHub Secrets.
5. Pour chaque secret à renouveler, guide-moi étape par étape dans l'interface du fournisseur, puis dis-moi où coller la nouvelle valeur (Vercel, Cloudflare, GitHub Secrets). Ne touche jamais toi-même aux variables d'environnement sans mon OK.

# PHASE 2 : PRÉPARATION (sur la branche `chore/private-repo-migration`)

Propose les changements sous forme de diff, sans rien appliquer avant mon accord :
1. Corriger les dépendances au caractère public repérées en phase 0 (liens raw, packages `github:`, badges, etc.).
2. Ajouter ou mettre à jour `.env.example` sans aucune valeur réelle.
3. Si des workflows GitHub Actions consomment trop de minutes, proposer des optimisations (cache, filtres `paths:`, `concurrency`).
4. Créer `docs/DEPLOYMENT.md` : architecture de déploiement actuelle (Vercel, Cloudflare) et cible, en langage simple.

# PHASE 3 : VÉRIFICATION DE L'EMAIL DES COMMITS (obligatoire, avant le passage en privé)

## Contexte à m'expliquer en 3 phrases simples
Chaque commit porte l'email de son auteur. Vercel compare cet email à ceux de mon compte GitHub. Si l'email ne correspond à aucun email vérifié chez GitHub, Vercel peut refuser de déployer le commit quand le repo est privé. C'est toi qui fais les commits : je dois donc m'assurer que tu utilises le bon email.

## Ce que TU fais (sans me demander de taper de commande)
1. Lis la configuration :
   - `git config user.name` et `git config user.email` (repo local)
   - `git config --global user.email`
   - `git log -5 --format='%an <%ae>'` (auteurs des 5 derniers commits)
2. Affiche-moi un mini-tableau : `source | nom | email`.
3. Dis-moi clairement OK ou PAS OK :
   - PAS OK si l'email est vide, générique (ex. `root@...`, `noreply@anthropic.com`, `user@localhost`) ou différent de celui de mon GitHub.
4. Ne continue pas tant que je n'ai pas fait l'étape manuelle ci-dessous.

## Ce que JE fais à la main : guide-moi une étape par message, attends mon "fait"
1. Ouvre https://github.com/settings/emails (connecte-toi si besoin).
2. Repère les emails marqués « Verified ». Dis-moi lequel tu vois.
3. Descends en bas de la page : cherche l'adresse de la forme `123456789+monpseudo@users.noreply.github.com`. Copie-la-moi ici.
4. Regarde si la case « Keep my email addresses private » est cochée. Dis-moi oui ou non.
5. Colle ta réponse dans le chat. C'est tout.

## Ensuite, TU fais
1. Compare ma réponse à la configuration git. Par défaut, utilise l'adresse noreply GitHub (toujours vérifiée, elle n'expose pas mon vrai email).
2. Si une correction est nécessaire, montre-moi les 2 commandes exactes et attends mon OK :
   `git config user.email "<adresse>"`
   `git config user.name "<mon pseudo GitHub>"`
   (Uniquement pour CE repo, sans `--global`.)
3. Ne réécris JAMAIS les anciens commits. Ne change pas l'email global de la machine.
4. Fais un commit de test sur `chore/private-repo-migration` (une ligne dans `docs/DEPLOYMENT.md`), puis vérifie avec `git log -1 --format='%ae'` que l'email du commit est le bon.
5. Pousse la branche et dis-moi de regarder la preview dans Vercel → mon projet → onglet Deployments.

## Comment on sait que c'est bon
- La preview Vercel du commit de test est verte.
- Si je vois « The commit author does not have access » ou « is not associated with a GitHub account », l'email est faux : reprends l'étape 1 de « Ensuite, TU fais ».
- Conclus par une ligne : "Email OK ✅" ou "Email à corriger ❌".

# PHASE 4 : PASSAGE EN PRIVÉ (actions manuelles guidées)

Ne commence que si : phase 1 terminée (secrets renouvelés), phase 3 en "Email OK ✅", et dernier déploiement de production vert. Note le hash du commit de production actuel : c'est notre point de retour en arrière.

## Ce que je dois savoir avant de confirmer
Explique-moi ces conséquences et demande-moi mon OK :
- les forks publics existants sont détachés ;
- les stars et watchers sont perdus ;
- les liens externes vers le repo renvoient une erreur 404 ;
- GitHub Pages, s'il est utilisé, peut nécessiter un plan payant.

## Passage en privé
Guide-moi : github.com → repo → Settings → General → tout en bas « Danger Zone » → « Change visibility » → Private. (Tu peux utiliser `gh repo edit --visibility private --accept-visibility-change-consequences` seulement si `gh` est installé ET que j'ai dit OK.)

## Juste après : réparer les intégrations, une par une
- **Vercel** (plan Hobby, compte personnel : les repos privés sont supportés) :
  a) L'application GitHub de Vercel a accès au repo : github.com → Settings → Applications → Vercel → Configure → Repository access. Si le mode est « Only select repositories », le repo doit y figurer.
  b) Dans Vercel → projet → Settings → Git : le repo est toujours connecté et la branche de production est la bonne.
  c) Redéploie un commit existant (sans nouveau code) pour valider la chaîne.
  d) Rappelle-moi que Hobby est réservé à un usage non commercial et demande-moi si mon usage l'est.
- **Cloudflare** :
  - Si Pages ou Workers Builds est connecté à GitHub : guide-moi pour ré-autoriser l'accès de l'application GitHub « Cloudflare » au repo privé, puis relance un build.
  - Si Cloudflare sert seulement de DNS/proxy : aucun changement attendu. Confirme-le après vérification.
  - Si un déploiement passe par `wrangler` dans GitHub Actions : vérifie que `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` sont bien dans GitHub Secrets.
- **GitHub Actions** : lance un workflow et vérifie qu'il passe. Vérifie les quotas de minutes.
- **Webhooks, deploy keys, Dependabot** : vérifie qu'ils fonctionnent toujours.

# PHASE 5 : VÉRIFICATION FINALE

1. Un commit de test sur une branche de preview doit produire : un build Vercel preview OK, un build Cloudflare OK si applicable, et des workflows verts.
2. Le site de production répond normalement : page d'accueil, une route dynamique, une route API, les assets.
3. Un rapport final en tableau : `élément | statut (OK/KO/à vérifier) | preuve`.
4. Un plan de retour en arrière, en langage simple : comment repasser le repo en public, et comment redéployer le dernier commit de production connu (donne le hash).

# FORMAT DE TES RÉPONSES

- Français, court, structuré, sans jargon.
- À chaque phase : ce que j'ai vérifié, ce que je suppose, ce que l'utilisateur doit faire à la main, ce que j'attends pour continuer.
- Aucune modification sans diff présenté avant.

Commence MAINTENANT par la PHASE 0 uniquement, puis arrête-toi.
