# MPG Companion

Compagnon de transferts et statistiques interactif pour manager MPG (Mon Petit Gazon) : tableau de bord, marché des transferts, fiches joueurs (scoutées par IA) et suivi des blessures, pour votre ligue.

## Stack technique

| Domaine       | Techno                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Frontend      | React 19 + TypeScript, Vite, Tailwind CSS 4                                                    |
| Backend       | Node.js + Express (mode dev : serveur API dédié port 3000 ; prod : fichiers statiques `dist/`) |
| IA            | Google GenAI SDK (`@google/genai`, modèle Gemini) avec Google Search grounding                 |
| Icônes / anim | lucide-react, motion                                                                           |
| Build         | Vite (client) + esbuild (bundle serveur `server.ts` → `dist/server.cjs`)                       |

## Démarrage local

**Prérequis :** Node.js, yarn

1. Installer les dépendances :
   ```bash
   yarn install
   ```
2. Renseigner les variables d'environnement dans `.env` (`GEMINI_API_KEY`, `PROJECT_URL_SUPABASE`, `SUPABASE_KEY`).
3. Lancer frontend + backend ensemble :

   ```bash
   yarn dev
   ```
   - Frontend (Vite) : [http://localhost:3001](http://localhost:3001)
   - Backend (Express, API only) : [http://localhost:3000](http://localhost:3000)
   - Le frontend proxy automatiquement les appels `/api/*` vers le backend (`vite.config.ts`) — pas de souci CORS, pas de config manuelle.

   Pour lancer séparément (2 terminaux, utile pour isoler les logs) :

   ```bash
   yarn dev:api   # backend seul, port 3000
   yarn dev:web   # frontend seul, port 3001
   ```

4. Build prod puis lancement :
   ```bash
   yarn build
   yarn start
   ```
   En prod, un seul serveur Express sert le build statique `dist/` (plus de split de ports).

Sans `GEMINI_API_KEY`, l'app reste utilisable : le backend bascule sur un générateur de joueur fictif (`generateFallbackPlayer`) pour ne jamais casser l'expérience.

## Commandes disponibles

| Commande            | Effet                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `yarn dev`          | Lance frontend (Vite) et backend (Express) en parallèle            |
| `yarn dev:api`      | Lance uniquement le serveur Express (`tsx server.ts`), port 3000   |
| `yarn dev:web`      | Lance uniquement Vite, port 3001                                   |
| `yarn build`        | Build client (Vite) + bundle serveur (esbuild → `dist/server.cjs`) |
| `yarn start`        | Lance le build de production (`node dist/server.cjs`)              |
| `yarn preview`      | Prévisualise le build Vite en local                                |
| `yarn clean`        | Supprime `dist/` et `server.js`                                    |
| `yarn typecheck`    | Vérifie les types TypeScript (`tsc --noEmit`), sans build          |
| `yarn lint`         | `typecheck` + ESLint (`eslint .`) sur tout le projet               |
| `yarn lint:fix`     | Applique les corrections ESLint automatiques (`eslint . --fix`)    |
| `yarn format`       | Reformate tous les fichiers avec Prettier (`prettier --write .`)   |
| `yarn format:check` | Vérifie le formatage sans modifier les fichiers, utile en CI       |

## System design

### 0. Schéma simplifié — flux Frontend / Backend / APIs

![Schéma simplifié](docs/diagrams/schema-simple.png)

_Diagramme Excalidraw — source éditable : [docs/diagrams/schema-simple.excalidraw](docs/diagrams/schema-simple.excalidraw)_

### 1. Architecture globale

![Architecture globale](docs/diagrams/architecture-globale.png)

_Diagramme Excalidraw — source éditable : [docs/diagrams/architecture-globale.excalidraw](docs/diagrams/architecture-globale.excalidraw)_

### 2. Composants frontend et données statiques

```mermaid
flowchart TB
    Types["types.ts\nPlayer, TransferMovement,\nInjuryItem, InjuryStatus"]
    Data["data.ts\nMOCK_PLAYERS, MOCK_TRANSFERS,\nMOCK_INJURIES"]
    Popular["popularPlayers.ts\nPOPULAR_PLAYERS (suggestions)"]
    SearchUtil["utils/search.ts\nmatchPlayer, normalizeText"]
    Avatar["components/PlayerAvatar.tsx"]

    App["App.tsx"] --> Data & Popular & SearchUtil & Types
    Dash["DashboardView.tsx"] --> Avatar
    Market["MarketView.tsx"] --> Avatar
    Profile["ProfileView.tsx"] --> Avatar
    Injuries["InjuriesView.tsx"] --> Avatar

    App -->|"onSelectPlayer\nonSearchQuery\nonShowToast"| Dash
    App -->|"onSelectPlayer\nonShowToast"| Market
    App -->|"player\nonShowToast"| Profile
    App -->|"onSelectPlayer\nonShowToast"| Injuries
```

### 3. Flux : recherche globale d'un joueur

![Diagramme de flux — recherche joueur](docs/diagrams/flux-recherche.png)

_Diagramme Excalidraw — source éditable : [docs/diagrams/flux-recherche.excalidraw](docs/diagrams/flux-recherche.excalidraw)_

<details>
<summary>Version séquence (Mermaid)</summary>

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant A as App.tsx
    participant S as utils/search.ts
    participant API as /api/search-player
    participant G as Gemini API

    U->>A: saisit un nom dans la barre de recherche
    A->>S: matchPlayer() sur MOCK_PLAYERS
    alt Correspondance locale trouvée
        A->>A: sélectionne le joueur mocké, onglet "stats"
    else Correspondance équipe (ex. "Lyon", "PSG")
        A->>A: filtre les joueurs de l'équipe, sélectionne le 1er
    else Aucune correspondance locale
        A->>API: GET /api/search-player?query=...
        API->>G: prompt JSON strict + Google Search grounding
        alt Réponse IA valide
            G-->>API: fiche joueur JSON réelle (saison 2025/2026)
        else Erreur / pas de clé API
            API->>API: generateFallbackPlayer(query)
        end
        API-->>A: { player }
        A->>A: sélectionne le joueur, onglet "stats"
    end
```

</details>

### 4. Vues (onglets) de l'application

```mermaid
flowchart LR
    Dashboard["Tableau de bord\n(accueil, transferts récents,\nrecherche rapide)"]
    Market["Marché\n(mouvements de transfert :\nofficiels, rumeurs, prolongations)"]
    Stats["Stats Joueurs\n(fiche détaillée du joueur\nsélectionné + comparaison)"]
    Injuries["Blessures\n(statuts : Absent, Incertain,\nReprise, Suspendu)"]

    Dashboard <--> Market
    Market <--> Stats
    Stats <--> Injuries
    Injuries <--> Dashboard
```

## Structure du projet

```
mpg-companion/
├── backend/
│   ├── server.ts                # Entrée serveur Express (dev + prod)
│   ├── app.ts                   # Config Express, routes, endpoint IA + compositions
│   ├── supabase.ts              # Client Supabase (cookies, RLS)
│   ├── middleware/               # requireAuth, rateLimit, errorHandler
│   ├── routes/                   # auth.ts, favorites.ts
│   ├── utils/asyncHandler.ts
│   ├── api/index.ts              # Entrée serverless Vercel
│   └── supabase/migrations/      # Migrations SQL
├── frontend/
│   ├── App.tsx                   # État global, navigation, recherche, modales
│   ├── main.tsx                  # Point d'entrée React
│   ├── types.ts                  # Types partagés (Player, InjuryItem, ...)
│   ├── data.ts                   # Données mockées (joueurs, transferts, blessures)
│   ├── popularPlayers.ts         # Liste de suggestions pour l'autocomplétion
│   ├── utils/search.ts           # Matching de joueurs (insensible aux accents)
│   ├── auth/                     # AuthContext, LoginModal
│   ├── favorites/                # FavoritesContext
│   └── components/
│       ├── DashboardView.tsx
│       ├── MarketView.tsx
│       ├── ProfileView.tsx
│       ├── InjuriesView.tsx
│       ├── FavoritesView.tsx
│       ├── FavoriteButton.tsx
│       └── PlayerAvatar.tsx
├── wireframes/                  # PDFs de wireframes et UI kit
└── dist/                        # Build de production (généré)
```

## Notes d'implémentation

- **Résilience recherche IA** : toute erreur (parsing JSON, API indisponible, pas de clé) retombe sur `generateFallbackPlayer`, jamais d'écran d'erreur bloquant côté utilisateur.
- **Cache compositions** : `GET /api/compositions` scrape `ligue1.com` avec retry/backoff sur 502/503, cache 6h en mémoire, et sert une donnée périmée (`stale: true`) plutôt qu'une erreur si le site est indisponible.
- **Recherche multi-niveaux** : nom de joueur local → nom d'équipe (mapping vers noms standardisés) → scouting IA distant, dans cet ordre de priorité pour limiter les appels API.

## Note sur cette documentation

L'architecture globale et le flux de recherche sont dessinés avec le toolkit Excalidraw (`mcp-excalidraw-server`, canvas local sur `http://127.0.0.1:3005`). Les sources éditables `.excalidraw` sont versionnées dans [docs/diagrams/](docs/diagrams/) — importez-les dans le canvas (`import <fichier>.excalidraw`) pour les modifier, puis ré-exportez le PNG. Les diagrammes des composants frontend et des vues restent en Mermaid (natif dans GitHub et la plupart des visualiseurs Markdown).
