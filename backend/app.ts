import path from "path";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
// Import à effet de bord : ouvre la connexion MongoDB (voir models/connection.ts).
import { connectionPromise } from "./models/connection.js";
import authRouter from "./routes/auth.js";
import footballRouter from "./routes/football.js";
import playersRouter from "./routes/players.js";
import dashboardRouter from "./routes/dashboard.js";
import transfersRouter from "./routes/transfers.js";
import injuriesRouter from "./routes/injuries.js";
import favoriteRouter from "./routes/favorite.js";

dotenv.config({ quiet: true });

const PORT = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === "production";

/** Logique du détecteur Vercel
 * Sur Vercel, pas de process persistant : app.listen() n'a rien à ouvrir,
 * et le fallback statique est déjà couvert par @vercel/static-build dans
 * vercel.json.
 */
const isVercel = Boolean(process.env.VERCEL);

const app = express();

app.use(express.json({ limit: "100kb" }));

/** Logique d'attente Mongo avant chaque route
 * En serverless, rien n'attend connectionPromise avant qu'une requête
 * arrive. Sans ce garde, la première requête d'un conteneur froid passe
 * par le buffering interne de mongoose et abandonne après 10s si Atlas
 * n'a pas fini de répondre — d'où "buffering timed out after 10000ms".
 */
app.use("/api", async (_req, res, next) => {
  try {
    await connectionPromise;
    next();
  } catch (error: unknown) {
    console.error(
      "MongoDB injoignable, requête refusée :",
      error instanceof Error ? error.message : error,
    );
    res.status(503).json({ error: "Base de données indisponible" });
  }
});

app.use("/api/favourites", favoriteRouter);

// Log minimal : une ligne par requête /api, avec le code de statut renvoyé.
app.use("/api", (req, res, next) => {
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

// Parcours de connexion : signup, signin, session, logout. Persisté en MongoDB.
// Le reste du site reste accessible sans compte.
app.use("/api/auth", authRouter);

app.use("/api/players", playersRouter);

// dashboard/transfers/injuries : appelées directement par DashboardView, MarketView
// et InjuriesView via fetch(), sans passer par Redux ni callApi.
app.use("/api/dashboard", dashboardRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/injuries", injuriesRouter);
app.use("/api/favorites", favoriteRouter);

// Route de contrôle : santé de la source de données et fiches statistiques détaillées.
app.use("/api/football", footballRouter);

/** Logique du filet de sécurité final
 * Renvoie du JSON aux appels /api et laisse le message technique côté
 * logs, jamais côté client. Express 5 y achemine tout seul les rejets
 * des handlers async.
 */
app.use("/api", (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  console.error(
    `Erreur non gérée sur ${req.method} ${req.originalUrl} :`,
    err instanceof Error ? err.message : err,
  );
  res.status(500).json({ error: "Erreur serveur" });
});

/** Logique du fallback statique
 * En dev, Vite (port 3001) proxy /api ici. En prod hors Vercel, ce
 * serveur sert aussi les fichiers construits par Vite, avec un fallback
 * SPA — Express 5 n'accepte plus le motif "*".
 */
if (isProduction && !isVercel) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/** Logique du démarrage local
 * On attend MongoDB avant d'ouvrir le port : démarrer sans base ferait
 * échouer toutes les requêtes d'auth avec une erreur obscure. Sur
 * Vercel, l'export par défaut suffit : @vercel/node invoque `app`
 * directement à chaque requête, sans jamais appeler listen().
 */
if (!isVercel) {
  connectionPromise
    .then(() => {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((error: unknown) => {
      console.error(
        "Démarrage impossible, MongoDB injoignable :",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    });
}

export default app;
