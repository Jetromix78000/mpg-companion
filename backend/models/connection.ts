import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ quiet: true });

const mongoUri = process.env.MONGODB_URI?.trim();

/** Logique d'échec selon l'environnement
 * Local : échoue fort et tôt, sinon les routes d'auth échouent avec une
 * erreur obscure. Vercel : `process.exit` tuerait la fonction entière,
 * y compris les routes mock — le module reste donc chargeable.
 */
const isVercel = Boolean(process.env.VERCEL);

if (!mongoUri && !isVercel) {
  console.error(
    "Variable d'environnement manquante : MONGODB_URI. Renseignez-la dans .env (voir .env.example).",
  );
  process.exit(1);
}

/** Logique du pool de connexions en serverless express
 * Chaque conteneur Atlas froid exécute ce fichier de zéro et ouvre son propre
 * pool. `maxPoolSize: 10` évite qu'une poignée de conteneurs sature les
 * 500 connexions du palier gratuit Atlas. `serverSelectionTimeoutMS: 8000`
 * reste sous les 10s d'une fonction Hobby, pour échouer avec un log plutôt que se faire couper en silence.
 */
const connectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 8000,
} as const;

/** Logique de la promesse de connexion
 * Créée une fois à l'import, elle sert de point de synchronisation :
 * `app.ts` l'attend avant de router une requête. Une promesse ne
 * s'exécute qu'une fois — les `await` suivants dans le même conteneur
 * sont immédiats.
 */
export const connectionPromise = mongoUri
  ? mongoose.connect(mongoUri, connectOptions).then((instance) => {
      console.log("MongoDB connecté: mpg-companion");
      return instance;
    })
  : Promise.reject(new Error("MONGODB_URI manquante"));

/** Logique de diagnostic de l'URI
 * Décrit l'URI sans jamais révéler le mot de passe. Atlas renvoie le même
 * message ("Could not connect to any servers") pour un whitelist manquant
 * qu'une URI mal recopiée — ceci distingue les deux depuis les logs.
 */
function describeUri(uri: string | undefined): string {
  if (!uri) return "URI absente";
  const match = /^(mongodb(?:\+srv)?):\/\/[^@]*@([^/?]+)(\/[^?]*)?/.exec(uri);
  if (!match) return `URI non reconnue (longueur ${uri.length}, début ${JSON.stringify(uri.slice(0, 12))})`;
  const [, scheme, host, database] = match;
  return `${scheme}://…@${host}${database ?? " (aucune base)"}`;
}

/** Logique du filet sur la promesse
 * Sans ce `catch`, le rejet resterait non géré sur Vercel (pas de
 * `listen()` pour le consommer) et couperait le process. Il ne rattrape
 * rien : il trace juste l'échec sans faire planter le serveur.
 */
connectionPromise.catch((error: unknown) => {
  console.error(
    "MongoDB injoignable :",
    error instanceof Error ? error.message : error,
  );
  console.error("URI utilisée :", describeUri(mongoUri));
});

export default mongoose;
