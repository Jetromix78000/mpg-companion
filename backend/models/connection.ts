import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ quiet: true });

const mongoUri = process.env.MONGODB_URI?.trim();

// En local on veut échouer fort et tôt : un serveur qui démarre sans base ferait
// échouer toutes les routes d'auth avec une erreur obscure. Sur Vercel en
// revanche, `process.exit` tue la fonction serverless entière — y compris les
// routes mock qui n'ont jamais besoin de Mongo. On y garde donc le module
// chargeable, et seules les routes qui touchent la base échouent.
const isVercel = Boolean(process.env.VERCEL);

if (!mongoUri && !isVercel) {
  console.error(
    "Variable d'environnement manquante : MONGODB_URI. Renseignez-la dans .env (voir .env.example).",
  );
  process.exit(1);
}

/**
 * Réglages taillés pour le serverless, où chaque conteneur froid ouvre son
 * propre pool de connexions :
 *
 * - `maxPoolSize` : mongoose monte jusqu'à 100 connexions par défaut. Le palier
 *   gratuit d'Atlas en plafonne 500 au total, donc quelques conteneurs
 *   simultanés suffisent à saturer le cluster — les suivants sont refusés avec
 *   "Could not connect to any servers", un message qui accuse à tort le
 *   whitelist. Une fonction ne traite qu'une requête à la fois : 10 suffisent.
 * - `serverSelectionTimeoutMS` : 30s par défaut, alors qu'une fonction Vercel
 *   Hobby est tuée à 10s. Échouer à 8s laisse le temps de répondre 503 plutôt
 *   que de se faire couper sans log exploitable.
 */
const connectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 8000,
} as const;

export const connectionPromise = mongoUri
  ? mongoose.connect(mongoUri, connectOptions).then((instance) => {
      console.log("MongoDB connecté: mpg-companion");
      return instance;
    })
  : Promise.reject(new Error("MONGODB_URI manquante"));

/**
 * Décrit l'URI sans jamais révéler le mot de passe : schéma, hôte et base.
 * Une connexion qui échoue alors qu'elle marche en local vient presque toujours
 * d'une valeur mal recopiée dans l'environnement distant — guillemets collés,
 * hôte mal orthographié, chaîne tronquée. Le message d'Atlas ("Could not connect
 * to any servers") reste identique dans tous ces cas et n'aide pas à trancher.
 */
function describeUri(uri: string | undefined): string {
  if (!uri) return "URI absente";
  const match = /^(mongodb(?:\+srv)?):\/\/[^@]*@([^/?]+)(\/[^?]*)?/.exec(uri);
  if (!match) return `URI non reconnue (longueur ${uri.length}, début ${JSON.stringify(uri.slice(0, 12))})`;
  const [, scheme, host, database] = match;
  return `${scheme}://…@${host}${database ?? " (aucune base)"}`;
}

// Sans ce catch, le rejet de la promesse ci-dessus reste non géré quand personne
// ne l'attend (cas Vercel : plus de bloc listen()), et Node coupe le process.
connectionPromise.catch((error: unknown) => {
  console.error(
    "MongoDB injoignable :",
    error instanceof Error ? error.message : error,
  );
  console.error("URI utilisée :", describeUri(mongoUri));
});

export default mongoose;
