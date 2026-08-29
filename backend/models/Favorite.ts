import { Schema, model, type HydratedDocument, Types } from "mongoose";

export interface FavoriteAttributes {
  user: Types.ObjectId;
  /** ID API-FOOTBALL du joueur (cf. backend/data/selectedPlayers.ts). */
  playerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type FavoriteDocument = HydratedDocument<FavoriteAttributes>;

const favoriteSchema = new Schema<FavoriteAttributes>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    playerId: { type: Number, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Un utilisateur ne peut pas mettre deux fois le même joueur en favori.
favoriteSchema.index({ user: 1, playerId: 1 }, { unique: true });

export const Favorite = model<FavoriteAttributes>("Favorite", favoriteSchema);