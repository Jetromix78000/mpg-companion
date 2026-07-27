import { Router } from "express";
import { requireAuth, requireSupabase } from "../middleware/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireSupabase, requireAuth);

const PLAYER_ID_REGEX = /^[a-z0-9-]{1,64}$/;

/** Favoris de l'utilisateur courant, les plus récents d'abord. */
router.get("/", asyncHandler(async (req, res) => {
  const { data, error } = await req.supabase!
    .from("favorites")
    .select("player_id, player_name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur lecture favoris :", error.message);
    return res.status(500).json({ error: "Favoris indisponibles" });
  }

  res.json({ favorites: data });
}));

/** Ajoute un joueur aux favoris. Idempotent : un double clic ne crée pas de doublon. */
router.post("/", asyncHandler(async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId.trim() : "";
  const playerName = typeof req.body?.playerName === "string" ? req.body.playerName.trim() : "";

  if (!PLAYER_ID_REGEX.test(playerId)) {
    return res.status(400).json({ error: "Identifiant joueur invalide" });
  }
  if (!playerName || playerName.length > 120) {
    return res.status(400).json({ error: "Nom de joueur invalide" });
  }

  // user_id vient de la session vérifiée, jamais du corps de la requête.
  const { data, error } = await req.supabase!
    .from("favorites")
    .upsert(
      { user_id: req.user!.id, player_id: playerId, player_name: playerName },
      { onConflict: "user_id,player_id" }
    )
    .select("player_id, player_name, created_at")
    .single();

  if (error) {
    console.error("Erreur ajout favori :", error.message);
    return res.status(500).json({ error: "Ajout impossible" });
  }

  res.status(201).json({ favorite: data });
}));

/** Retire un joueur des favoris. La policy RLS limite déjà la suppression aux lignes de l'utilisateur. */
router.delete("/:playerId", asyncHandler(async (req, res) => {
  const playerId = req.params.playerId;

  if (!PLAYER_ID_REGEX.test(playerId)) {
    return res.status(400).json({ error: "Identifiant joueur invalide" });
  }

  const { error } = await req.supabase!
    .from("favorites")
    .delete()
    .eq("user_id", req.user!.id)
    .eq("player_id", playerId);

  if (error) {
    console.error("Erreur suppression favori :", error.message);
    return res.status(500).json({ error: "Suppression impossible" });
  }

  res.status(204).end();
}));

export default router;
