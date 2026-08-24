import { Router } from "express";
import { ApiFootballError, getDashboard } from "./apiFootball";

const router = Router();

router.get("/", (_req, res) => {
  getDashboard()
    .then((payload) => {
      res.json(payload);
    })
    .catch((error: unknown) => {
      if (error instanceof ApiFootballError) {
        res.status(error.status).json({ ok: false, error: error.message });
      } else {
        res.status(500).json({ ok: false, error: "Erreur serveur" });
      }
    });
});

export default router;