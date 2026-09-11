import { Router } from "express";
import { searchStocks, resolveOne } from "../services/krxList.js";
import { getQuotes } from "../services/quotes.js";
import { investigateCause } from "../services/analyze.js";
import type { StockInfo } from "../types.js";

export const apiRouter = Router();

apiRouter.get("/config", (_req, res) => {
  res.json({
    dartEnabled: Boolean(process.env.DART_API_KEY?.trim()),
    naverEnabled: Boolean(process.env.NAVER_CLIENT_ID?.trim() && process.env.NAVER_CLIENT_SECRET?.trim()),
    aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  });
});

apiRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "");
  try {
    const results = await searchStocks(q, 10);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post("/resolve", async (req, res) => {
  const query = String(req.body?.query ?? "");
  try {
    const result = await resolveOne(query);
    if (!result) return res.status(404).json({ error: "종목을 찾을 수 없습니다" });
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

apiRouter.post("/quotes", async (req, res) => {
  const stocks = (req.body?.stocks ?? []) as StockInfo[];
  if (!Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: "stocks 배열이 필요합니다" });
  }
  if (stocks.length > 50) {
    return res.status(400).json({ error: "최대 50개까지 분석할 수 있습니다" });
  }
  try {
    const results = await getQuotes(stocks);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

apiRouter.post("/analyze", async (req, res) => {
  const targets = (req.body?.targets ?? []) as Array<{ code: string; name: string; changePct: number }>;
  if (!Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: "targets 배열이 필요합니다" });
  }
  try {
    const results = await mapWithConcurrency(targets, 3, (t) =>
      investigateCause({ code: t.code, name: t.name }, t.changePct)
    );
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
