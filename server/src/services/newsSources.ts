import { XMLParser } from "fast-xml-parser";
import type { SourceItem, SourceType } from "../types.js";

const xmlParser = new XMLParser({ ignoreAttributes: false });

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

async function fetchGoogleNewsRss(
  query: string,
  opts: { hl: string; gl: string; ceid: string },
  type: SourceType,
  limit = 5
): Promise<SourceItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query
    )}&hl=${opts.hl}&gl=${opts.gl}&ceid=${opts.ceid}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (StockMoveFinder)" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const items = parsed?.rss?.channel?.item ?? [];
    const arr = Array.isArray(items) ? items : [items];
    return arr.slice(0, limit).map((it: any): SourceItem => ({
      type,
      title: stripHtml(String(it.title ?? "")),
      url: it.link ?? undefined,
      publishedAt: it.pubDate ?? undefined,
      snippet: stripHtml(String(it.description ?? "")).slice(0, 300),
    }));
  } catch (err) {
    console.warn("[newsSources] google news rss failed:", (err as Error).message);
    return [];
  }
}

export async function getDomesticNewsFallback(name: string): Promise<SourceItem[]> {
  return fetchGoogleNewsRss(name, { hl: "ko", gl: "KR", ceid: "KR:ko" }, "news_kr");
}

export async function getGlobalNews(name: string): Promise<SourceItem[]> {
  return fetchGoogleNewsRss(name, { hl: "en", gl: "US", ceid: "US:en" }, "news_global");
}

function naverKeys(): { id: string; secret: string } | null {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  return { id, secret };
}

async function naverSearch(
  endpoint: "news" | "cafearticle" | "blog",
  query: string,
  type: SourceType,
  limit = 5
): Promise<SourceItem[]> {
  const keys = naverKeys();
  if (!keys) return [];
  try {
    const url = `https://openapi.naver.com/v1/search/${endpoint}.json?query=${encodeURIComponent(
      query
    )}&display=${limit}&sort=date`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": keys.id,
        "X-Naver-Client-Secret": keys.secret,
      },
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const items: any[] = json.items ?? [];
    return items.map((it): SourceItem => ({
      type,
      title: stripHtml(String(it.title ?? "")),
      url: it.link ?? it.originallink ?? undefined,
      publishedAt: it.pubDate ?? it.postdate ?? undefined,
      snippet: stripHtml(String(it.description ?? "")).slice(0, 300),
    }));
  } catch (err) {
    console.warn(`[newsSources] naver ${endpoint} search failed:`, (err as Error).message);
    return [];
  }
}

export async function getDomesticNews(name: string): Promise<SourceItem[]> {
  const viaNaver = await naverSearch("news", name, "news_kr");
  if (viaNaver.length > 0) return viaNaver;
  return getDomesticNewsFallback(name);
}

/** 국내 투자 커뮤니티 proxy via Naver Cafe search (requires key). Always flagged as unconfirmed by the caller. */
export async function getDomesticCommunity(name: string): Promise<SourceItem[]> {
  return naverSearch("cafearticle", `${name} 주가`, "community_kr");
}

/** Best-effort, keyless overseas community/SNS proxy via Reddit's public search JSON. May fail/be rate-limited. */
export async function getGlobalCommunity(name: string): Promise<SourceItem[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(name)}&sort=new&limit=5`;
    const res = await fetch(url, { headers: { "User-Agent": "StockMoveFinder/1.0" } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const children: any[] = json?.data?.children ?? [];
    return children.slice(0, 5).map((c): SourceItem => ({
      type: "sns",
      title: stripHtml(String(c.data?.title ?? "")),
      url: c.data?.permalink ? `https://www.reddit.com${c.data.permalink}` : undefined,
      publishedAt: c.data?.created_utc
        ? new Date(c.data.created_utc * 1000).toISOString()
        : undefined,
      snippet: stripHtml(String(c.data?.selftext ?? "")).slice(0, 300),
    }));
  } catch (err) {
    console.warn("[newsSources] reddit search failed:", (err as Error).message);
    return [];
  }
}
