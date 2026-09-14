import { Schema, model, type HydratedDocument } from "mongoose";

export type UserAttributes = {
  email: string;
  passwordHash: string;
  token: string | null;
  displayName?: string;
};

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  token: { type: String, default: null, index: { unique: true, sparse: true } },
  displayName: { type: String, trim: true },
});

/**
 * L'utilisateur se connecte ailleurs ou se déconnecte.
 * Son ancien token devient invalide, une seule session reste active.
 */

export const User = model<UserAttributes>("User", userSchema);
