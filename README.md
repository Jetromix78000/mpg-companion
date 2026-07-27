# MPG Companion

Compagnon de transferts et statistiques interactif pour manager MPG (Mon Petit Gazon) : tableau de bord, marché des transferts, fiches joueurs (scoutées par IA) et suivi des blessures, pour votre ligue.

## Stack technique

| Domaine | Techno |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS 4 |
| Backend | Node.js + Express (mode dev : middleware Vite ; prod : fichiers statiques `dist/`) |
| IA | Google GenAI SDK (`@google/genai`, modèle Gemini) avec Google Search grounding |
| Icônes / anim | lucide-react, motion |
| Build | Vite (client) + esbuild (bundle serveur `server.ts` → `dist/server.cjs`) |

## Démarrage local

**Prérequis :** Node.js

1. Installer les dépendances : `npm install`
2. Renseigner `GEMINI_API_KEY` dans `.env`
3. Lancer en dev : `npm run dev` (tsx exécute `server.ts`, qui monte Vite en middleware)
4. Build prod : `npm run build` puis `npm start`

Sans `GEMINI_API_KEY`, l'app reste utilisable : le backend bascule sur un générateur de joueur fictif (`generateFallbackPlayer`) pour ne jamais casser l'expérience.

## System design

### 0. Schéma simplifié — flux Frontend / Backend / APIs

![Schéma simplifié](docs/diagrams/schema-simple.png)

*Diagramme Excalidraw — source éditable : [docs/diagrams/schema-simple.excalidraw](docs/diagrams/schema-simple.excalidraw)*

### 1. Architecture globale

![Architecture globale](docs/diagrams/architecture-globale.png)

*Diagramme Excalidraw — source éditable : [docs/diagrams/architecture-globale.excalidraw](docs/diagrams/architecture-globale.excalidraw)*

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

*Diagramme Excalidraw — source éditable : [docs/diagrams/flux-recherche.excalidraw](docs/diagrams/flux-recherche.excalidraw)*

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
├── server.ts                  # Serveur Express : API IA + scraping compositions
├── src/
│   ├── App.tsx                 # État global, navigation, recherche, modales
│   ├── main.tsx                # Point d'entrée React
│   ├── types.ts                # Types partagés (Player, InjuryItem, ...)
│   ├── data.ts                 # Données mockées (joueurs, transferts, blessures)
│   ├── popularPlayers.ts        # Liste de suggestions pour l'autocomplétion
│   ├── utils/search.ts          # Matching de joueurs (insensible aux accents)
│   └── components/
│       ├── DashboardView.tsx
│       ├── MarketView.tsx
│       ├── ProfileView.tsx
│       ├── InjuriesView.tsx
│       └── PlayerAvatar.tsx
├── wireframes/                 # PDFs de wireframes et UI kit
└── dist/                       # Build de production (généré)
```

## Notes d'implémentation

- **Résilience recherche IA** : toute erreur (parsing JSON, API indisponible, pas de clé) retombe sur `generateFallbackPlayer`, jamais d'écran d'erreur bloquant côté utilisateur.
- **Cache compositions** : `GET /api/compositions` scrape `ligue1.com` avec retry/backoff sur 502/503, cache 6h en mémoire, et sert une donnée périmée (`stale: true`) plutôt qu'une erreur si le site est indisponible.
- **Recherche multi-niveaux** : nom de joueur local → nom d'équipe (mapping vers noms standardisés) → scouting IA distant, dans cet ordre de priorité pour limiter les appels API.

## Note sur cette documentation

L'architecture globale et le flux de recherche sont dessinés avec le toolkit Excalidraw (`mcp-excalidraw-server`, canvas local sur `http://127.0.0.1:3005`). Les sources éditables `.excalidraw` sont versionnées dans [docs/diagrams/](docs/diagrams/) — importez-les dans le canvas (`import <fichier>.excalidraw`) pour les modifier, puis ré-exportez le PNG. Les diagrammes des composants frontend et des vues restent en Mermaid (natif dans GitHub et la plupart des visualiseurs Markdown).
