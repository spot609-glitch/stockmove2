import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";

/**
 * The bare API app, with no static-file serving or app.listen(). This is the
 * piece Vercel's serverless function (api/index.ts) imports directly — on
 * Vercel the frontend is served separately as a static site, and only /api/*
 * requests are routed to this app. `server/src/index.ts` wraps this same app
 * with static serving + listen() for local dev and non-Vercel deployments.
 */
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);

export default app;
