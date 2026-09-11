import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import seedList from "../data/krxSeed.json" with { type: "json" };
import type { StockInfo } from "../types.js";

const KRX_LIST_URL =
  "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache: { list: StockInfo[]; fetchedAt: number; source: "live" | "seed" } | null = null;

async function fetchLiveList(): Promise<StockInfo[]> {
  const res = await fetch(KRX_LIST_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (StockMoveFinder)" },
  });
  if (!res.ok) throw new Error(`KRX list fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buf, "euc-kr");
  const $ = cheerio.load(html);
  const rows: StockInfo[] = [];
  $("table tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 2) return;
    const name = $(tds[0]).text().trim();
    const code = $(tds[1]).text().trim();
    if (/^\d{6}$/.test(code) && name) {
      rows.push({ code, name });
    }
  });
  if (rows.length === 0) throw new Error("KRX list parse produced 0 rows");
  return rows;
}

export async function getKrxList(): Promise<{ list: StockInfo[]; source: "live" | "seed" }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { list: cache.list, source: cache.source };
  }
  try {
    const live = await fetchLiveList();
    cache = { list: live, fetchedAt: now, source: "live" };
    return { list: live, source: "live" };
  } catch (err) {
    console.warn("[krxList] live fetch failed, falling back to seed list:", (err as Error).message);
    const seed = seedList as StockInfo[];
    cache = { list: seed, fetchedAt: now, source: "seed" };
    return { list: seed, source: "seed" };
  }
}

export async function searchStocks(query: string, limit = 10): Promise<StockInfo[]> {
  const q = query.trim();
  if (!q) return [];
  const { list } = await getKrxList();
  if (/^\d+$/.test(q)) {
    return list.filter((s) => s.code.startsWith(q)).slice(0, limit);
  }
  const lower = q.toLowerCase();
  const exact = list.filter((s) => s.name.toLowerCase() === lower);
  const starts = list.filter(
    (s) => s.name.toLowerCase().startsWith(lower) && s.name.toLowerCase() !== lower
  );
  const includes = list.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) &&
      !s.name.toLowerCase().startsWith(lower)
  );
  return [...exact, ...starts, ...includes].slice(0, limit);
}

export async function resolveOne(query: string): Promise<StockInfo | null> {
  const q = query.trim();
  if (!q) return null;
  const { list } = await getKrxList();
  if (/^\d{6}$/.test(q)) {
    return list.find((s) => s.code === q) ?? { code: q, name: q };
  }
  const results = await searchStocks(q, 1);
  return results[0] ?? null;
}
