import type { QuoteResult, StockInfo } from "../types.js";

const NAVER_POLLING_URL = "https://polling.finance.naver.com/api/realtime/domestic/stock/";

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Naver's public (keyless) polling endpoint returns current price ("nv") and
 * previous close ("pcv") per code. Field names have shifted over the years in
 * the wild, so we probe a few known aliases defensively.
 */
async function fetchBatch(codes: string[]): Promise<Map<string, { current: number | null; prevClose: number | null }>> {
  const url = NAVER_POLLING_URL + codes.join(",");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (StockMoveFinder)",
      Referer: "https://finance.naver.com/",
    },
  });
  if (!res.ok) throw new Error(`Naver quote fetch failed: ${res.status}`);
  const json: any = await res.json();
  const datas: any[] = json?.result?.areas?.[0]?.datas ?? [];
  const map = new Map<string, { current: number | null; prevClose: number | null }>();
  for (const d of datas) {
    const code = d.cd ?? d.code ?? d.itemCode;
    if (!code) continue;
    const current = toNumber(d.nv ?? d.now ?? d.closePrice ?? d.tradePrice);
    const prevClose = toNumber(d.pcv ?? d.previousClose ?? d.sv ?? d.standardPrice);
    map.set(code, { current, prevClose });
  }
  return map;
}

export async function getQuotes(stocks: StockInfo[]): Promise<QuoteResult[]> {
  const results: QuoteResult[] = [];
  const chunkSize = 50;
  for (let i = 0; i < stocks.length; i += chunkSize) {
    const chunk = stocks.slice(i, i + chunkSize);
    try {
      const map = await fetchBatch(chunk.map((s) => s.code));
      for (const s of chunk) {
        const q = map.get(s.code);
        if (!q || q.current === null || q.prevClose === null || q.prevClose === 0) {
          results.push({
            code: s.code,
            name: s.name,
            currentPrice: q?.current ?? null,
            prevClose: q?.prevClose ?? null,
            changePct: null,
            error: "가격 데이터를 가져올 수 없습니다",
          });
          continue;
        }
        const changePct = ((q.current - q.prevClose) / q.prevClose) * 100;
        results.push({
          code: s.code,
          name: s.name,
          currentPrice: q.current,
          prevClose: q.prevClose,
          changePct,
        });
      }
    } catch (err) {
      for (const s of chunk) {
        results.push({
          code: s.code,
          name: s.name,
          currentPrice: null,
          prevClose: null,
          changePct: null,
          error: (err as Error).message || "가격 조회 실패",
        });
      }
    }
  }
  return results;
}
