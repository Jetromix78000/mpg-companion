import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/**
 * Connexion à MongoDB Atlas.
 *
 * La chaîne de connexion se renseigne dans `.env`, clé MONGODB_URI (modèle dans
 * .env.example). Ce fichier-ci est versionné, contrairement à .env : y écrire la
 * chaîne en dur publierait l'identifiant et le mot de passe du cluster dans le dépôt.
 *
 * Importer ce module suffit à ouvrir la connexion — c'est ce que fait backend/app.ts.
 * La promesse est aussi exportée pour que server.ts puisse l'attendre avant d'ouvrir
 * le port, et pour qu'un échec donne un message clair plutôt qu'une cascade de
 * requêtes en erreur.
 */

const mongoUri = process.env.MONGODB_URI?.trim();

if (!mongoUri) {
  console.error(
    "Variable d'environnement manquante : MONGODB_URI. Renseignez-la dans .env (voir .env.example).",
  );
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";

// Sans cette option, une requête sur une collection inaccessible attend 30 s
// par défaut avant de rendre la main.
mongoose.set("bufferTimeoutMS", 5000);
mongoose.set("strictQuery", true);

mongoose.connection.on("error", (error) => {
  console.error("Erreur de connexion MongoDB :", error instanceof Error ? error.message : error);
});

mongoose.connection.on("disconnected", () => {
  if (!isProduction) console.warn("MongoDB déconnecté");
});

/**
 * Promesse mémorisée : en serverless (backend/api/index.ts sur Vercel) le module
 * est réévalué à froid mais réutilisé à chaud, et sans ce cache chaque requête
 * ouvrirait une connexion de plus jusqu'à saturer le pool du cluster.
 */
export const connectionPromise: Promise<typeof mongoose> = mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
  .then((instance) => {
    console.log(`MongoDB connecté : ${instance.connection.name}`);
    return instance;
  });

/** Utilisé par les tests et l'arrêt propre du serveur. */
export function disconnect(): Promise<void> {
  return mongoose.disconnect();
}

export default mongoose;
