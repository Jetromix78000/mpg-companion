import { Schema, model, type HydratedDocument } from "mongoose";

export interface UserAttributes {
  email: string;
  passwordHash: string;
  /** Token de session, généré à l'inscription et à la connexion. Vidé au logout. */
  token: string | null;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

/**
 * Schéma purement déclaratif : la comparaison du mot de passe ne vit pas ici mais
 * dans backend/app.ts (verifyPassword), avec le reste de bcrypt.
 */
const userSchema = new Schema<UserAttributes>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // select: false garde le hash hors de toute lecture qui ne le demande pas
    // explicitement — y compris les populate et les find() écrits plus tard.
    passwordHash: { type: String, required: true, select: false },
    // sparse : plusieurs utilisateurs déconnectés ont token à null, l'unicité ne
    // doit s'appliquer qu'aux tokens réellement présents.
    token: { type: String, default: null, index: { unique: true, sparse: true } },
    displayName: { type: String, trim: true, maxlength: 60 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.token;
        return ret;
      },
    },
  },
);

export const User = model<UserAttributes>("User", userSchema);
