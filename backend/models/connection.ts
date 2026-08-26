import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ quiet: true });

const mongoUri = process.env.MONGODB_URI?.trim();

if (!mongoUri) {
  console.error(
    "Variable d'environnement manquante : MONGODB_URI. Renseignez-la dans .env (voir .env.example).",
  );
  process.exit(1);
}

export const connectionPromise = mongoose.connect(mongoUri).then((instance) => {
  console.log("MongoDB connecté: mpg-companion");
  return instance;
});

export default mongoose;
