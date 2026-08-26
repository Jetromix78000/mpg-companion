import { Schema, model, type HydratedDocument } from "mongoose";

export interface UserAttributes {
  email: string;
  passwordHash: string;
  token: string | null;
  displayName?: string;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  token: { type: String, default: null, index: { unique: true, sparse: true } },
  displayName: { type: String, trim: true },
});

/** Logique
 * token est unique pour éviter que plusieurs comptes soient connectés en même temps.
 * token est nullable pour permettre à un compte de se déconnecter (token = null).
 * token est sparse pour permettre à plusieurs comptes d'avoir token = null (sparse = true).
 */

export const User = model<UserAttributes>("User", userSchema);
