import app from "../server/src/app.js";

// Vercel Serverless Function entrypoint. All /api/* requests are rewritten
// here (see vercel.json), and the Express app matches the real path itself
// since Vercel preserves the original URL on a rewrite.
export default app;
