import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";

/**
 * Local dev / non-Vercel deployment entrypoint (Render, Railway, a VM, `npm run dev`, ...).
 * On Vercel this file is never used — api/index.ts imports app.ts directly and
 * the frontend is served as a static site instead.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webDist = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Stock Move Finder server listening on http://localhost:${PORT}`);
});
