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

export const connectionPromise = mongoUri
  ? mongoose.connect(mongoUri).then((instance) => {
      console.log("MongoDB connecté: mpg-companion");
      return instance;
    })
  : Promise.reject(new Error("MONGODB_URI manquante"));

// Sans ce catch, le rejet de la promesse ci-dessus reste non géré quand personne
// ne l'attend (cas Vercel : plus de bloc listen()), et Node coupe le process.
connectionPromise.catch((error: unknown) => {
  console.error(
    "MongoDB injoignable :",
    error instanceof Error ? error.message : error,
  );
});

export default mongoose;
