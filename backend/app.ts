import path from "path";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
// Import à effet de bord : ouvre la connexion MongoDB (voir models/connection.ts).
import { connectionPromise } from "./models/connection";
import authRouter from "./routes/auth";
import footballRouter from "./routes/football";
import playersRouter from "./routes/players";
import dashboardRouter from "./routes/dashboard";
import transfersRouter from "./routes/transfers";
import injuriesRouter from "./routes/injuries";

dotenv.config({ quiet: true });

const PORT = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === "production";

const app = express();

app.use(express.json({ limit: "100kb" }));

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

// Route de contrôle : santé de la source de données et fiches statistiques détaillées.
app.use("/api/football", footballRouter);

/**
 * Filet de sécurité en fin de chaîne : renvoie du JSON aux appels /api et laisse
 * le message technique côté logs, jamais côté client.
 * Express 5 y achemine tout seul les rejets des handlers async.
 */
app.use("/api", (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  console.error(
    `Erreur non gérée sur ${req.method} ${req.originalUrl} :`,
    err instanceof Error ? err.message : err,
  );
  res.status(500).json({ error: "Erreur serveur" });
});

// En dev, le frontend tourne sur Vite (port 3001, yarn dev:web) qui proxy /api ici.
// En production, ce serveur sert aussi les fichiers construits par Vite.
if (isProduction) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  // Express 5 n'accepte plus le motif "*" : un app.use final couvre toutes les
  // routes non servies par les assets statiques (fallback SPA).
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// On attend MongoDB avant d'ouvrir le port : démarrer sans base ferait échouer
// toutes les requêtes d'auth avec une erreur obscure plutôt qu'un message clair.
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

export default app;
