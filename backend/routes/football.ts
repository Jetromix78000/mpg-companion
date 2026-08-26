import { Router } from "express";
import { API_FOOTBALL_BASE_URL, ApiFootballError, apiFootballFetchEnvelope, getPlayerFootballStats } from "./apiFootball";
import { SELECTED_PLAYERS } from "../data/selectedPlayers";

const router = Router();

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY?.trim() ?? "";

router.get("/health", (_req, res) => {
  apiFootballFetchEnvelope<unknown[]>("/status")
    .then((envelope) => {
      res.json({ ok: true, baseUrl: API_FOOTBALL_BASE_URL, response: envelope.response });
    })
    .catch((error: unknown) => {
      if (error instanceof ApiFootballError) {
        res.status(error.status).json({ ok: false, error: error.message });
      } else {
        res.status(500).json({ ok: false, error: "Erreur serveur" });
      }
    });
});

router.get("/stats", (req, res) => {
  const playerIdParam = req.query.playerId;

  if (typeof playerIdParam !== "string" || !playerIdParam.trim()) {
    return res.status(400).json({ error: "Paramètre playerId manquant" });
  }

  const playerId = Number(playerIdParam);
  if (!Number.isInteger(playerId)) {
    return res.status(400).json({ error: "playerId doit être un nombre entier" });
  }

  getPlayerFootballStats(playerId)
    .then((stats) => {
      res.json(stats);
    })
    .catch((error: unknown) => {
      if (error instanceof ApiFootballError) {
        res.status(error.status).json({ ok: false, error: error.message });
      } else {
        res.status(500).json({ ok: false, error: "Erreur serveur" });
      }
    });
});

router.get("/players", (_req, res) => {
  res.json(SELECTED_PLAYERS);
});

export default router;