import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ quiet: true });

const mongoUri = process.env.MONGODB_URI?.trim();

/**
 * L'utilisateur lance le serveur sans MONGODB_URI en local.
 * Le démarrage échoue tout de suite avec un message clair.
 */
const isVercel = Boolean(process.env.VERCEL);

if (!mongoUri && !isVercel) {
  console.error(
    "Variable d'environnement manquante : MONGODB_URI. Renseignez-la dans .env (voir .env.example).",
  );
  process.exit(1);
}

/**
 * L'utilisateur déclenche un cold start serverless sur Vercel.
 * Le pool Mongo reste borné pour ne pas saturer le palier gratuit Atlas.
 */
const connectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 8000,
} as const;

/**
 * L'utilisateur envoie une requête /api pendant que Mongo se connecte.
 * Sa requête attend cette même promesse avant d'être routée.
 */
export const connectionPromise = mongoUri
  ? mongoose.connect(mongoUri, connectOptions).then((instance) => {
      console.log("MongoDB connecté: mpg-companion");
      return instance;
    })
  : Promise.reject(new Error("MONGODB_URI manquante"));

/**
 * La connexion Mongo échoue au démarrage.
 * L'URI est décrite dans les logs sans jamais exposer le mot de passe.
 */
function describeUri(uri: string | undefined): string {
  if (!uri) return "URI absente";
  const match = /^(mongodb(?:\+srv)?):\/\/[^@]*@([^/?]+)(\/[^?]*)?/.exec(uri);
  if (!match) return `URI non reconnue (longueur ${uri.length}, début ${JSON.stringify(uri.slice(0, 12))})`;
  const [, scheme, host, database] = match;
  return `${scheme}://…@${host}${database ?? " (aucune base)"}`;
}

/**
 * L'utilisateur charge le site pendant que Mongo est injoignable.
 * L'erreur est tracée dans les logs sans faire planter le serveur.
 */
connectionPromise.catch((error: unknown) => {
  console.error(
    "MongoDB injoignable :",
    error instanceof Error ? error.message : error,
  );
  console.error("URI utilisée :", describeUri(mongoUri));
});

export default mongoose;
