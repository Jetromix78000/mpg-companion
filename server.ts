import path from "path";
import express from "express";
import app from "./src/server/app";

const PORT = 3000;

// En dev, le frontend tourne sur Vite (port 3001, npm run dev:web) qui proxy /api vers ce serveur.
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
