import { Schema, model, type HydratedDocument, Types } from "mongoose";

export interface FavoriteAttributes {
  user: Types.ObjectId;
  playerId: string;
  playerName: string;
  playerFullName: string;
  team: string;
  avatarUrl?: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FavoriteDocument = HydratedDocument<FavoriteAttributes>;

const favoriteSchema = new Schema<FavoriteAttributes>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    playerId: { type: String, required: true },
    playerName: { type: String, required: true },
    playerFullName: { type: String, required: true },
    team: { type: String, required: true },
    avatarUrl: { type: String },
    position: { type: String, required: true },
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
