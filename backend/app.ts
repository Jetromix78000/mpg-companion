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

/**
 * L'utilisateur charge le site déployé sur Vercel.
 * app.listen() ne s'exécute pas, @vercel/static-build gère déjà le fallback.
 */
const isVercel = Boolean(process.env.VERCEL);

const app = express();

app.use(express.json({ limit: "100kb" }));

/**
 * L'utilisateur appelle une route /api sur un conteneur serverless froid.
 * Sa requête attend que MongoDB soit prêt avant de continuer.
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

// Log minimal : une ligne par requête /api, avec le code de statut renvoyé.
app.use("/api", (req, res, next) => {
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

/**
 * L'utilisateur s'inscrit, se connecte ou navigue sans compte.
 * Le reste du site reste accessible même sans authentification.
 */
app.use("/api/auth", authRouter);

app.use("/api/players", playersRouter);

/**
 * L'utilisateur ouvre Dashboard, Marché ou Blessures.
 * Chaque vue récupère ses données en direct, sans passer par Redux.
 */
app.use("/api/dashboard", dashboardRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/injuries", injuriesRouter);
app.use("/api/favorites", favoriteRouter);

/**
 * L'utilisateur ouvre la fiche stats d'un joueur.
 * Santé de la source et détail statistique sont servis ici.
 */
app.use("/api/football", footballRouter);

/**
 * L'utilisateur déclenche une erreur non gérée sur une route /api.
 * Il reçoit un message générique, le détail technique reste dans les logs.
 */
app.use("/api", (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  console.error(
    `Erreur non gérée sur ${req.method} ${req.originalUrl} :`,
    err instanceof Error ? err.message : err,
  );
  res.status(500).json({ error: "Erreur serveur" });
});

/**
 * L'utilisateur ouvre n'importe quelle page en prod hors Vercel.
 * Le HTML du build Vite lui est servi, avec fallback SPA.
 */
if (isProduction && !isVercel) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/**
 * L'utilisateur lance le serveur en local.
 * Le port ne s'ouvre qu'une fois MongoDB joignable.
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
