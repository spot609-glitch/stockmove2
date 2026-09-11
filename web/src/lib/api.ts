import type { CauseResult, QuoteResult, ServerConfig, StockInfo } from "../types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function searchStocks(query: string): Promise<StockInfo[]> {
  if (!query.trim()) return [];
  const { results } = await jsonFetch<{ results: StockInfo[] }>(
    `/api/search?q=${encodeURIComponent(query)}`
  );
  return results;
}

export async function resolveStock(query: string): Promise<StockInfo> {
  const { result } = await jsonFetch<{ result: StockInfo }>("/api/resolve", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  return result;
}

export async function fetchQuotes(stocks: StockInfo[]): Promise<QuoteResult[]> {
  const { results } = await jsonFetch<{ results: QuoteResult[] }>("/api/quotes", {
    method: "POST",
    body: JSON.stringify({ stocks }),
  });
  return results;
}

export async function analyzeCauses(
  targets: Array<{ code: string; name: string; changePct: number }>
): Promise<CauseResult[]> {
  const { results } = await jsonFetch<{ results: CauseResult[] }>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ targets }),
  });
  return results;
}

export async function fetchConfig(): Promise<ServerConfig> {
  return jsonFetch<ServerConfig>("/api/config");
}
