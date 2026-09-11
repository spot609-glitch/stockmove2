import unzipper from "unzipper";
import { XMLParser } from "fast-xml-parser";
import type { SourceItem } from "../types.js";

const CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml";
const LIST_URL = "https://opendart.fss.or.kr/api/list.json";

let corpCodeMap: Map<string, string> | null = null; // stock_code -> corp_code
let corpCodeFetchedAt = 0;
const CORP_CODE_TTL_MS = 24 * 60 * 60 * 1000;

function apiKey(): string | null {
  return process.env.DART_API_KEY?.trim() || null;
}

async function loadCorpCodeMap(): Promise<Map<string, string>> {
  const key = apiKey();
  if (!key) return new Map();
  const now = Date.now();
  if (corpCodeMap && now - corpCodeFetchedAt < CORP_CODE_TTL_MS) return corpCodeMap;

  const res = await fetch(`${CORP_CODE_URL}?crtfc_key=${key}`);
  if (!res.ok) throw new Error(`DART corpCode fetch failed: ${res.status}`);
  const zipBuf = Buffer.from(await res.arrayBuffer());
  const directory = await unzipper.Open.buffer(zipBuf);
  const xmlFile = directory.files.find((f) => f.path.endsWith(".xml"));
  if (!xmlFile) throw new Error("DART corpCode.xml not found in archive");
  const xmlBuf = await xmlFile.buffer();

  const parser = new XMLParser();
  const parsed = parser.parse(xmlBuf.toString("utf-8"));
  const list = parsed?.result?.list ?? [];
  const arr = Array.isArray(list) ? list : [list];

  const map = new Map<string, string>();
  for (const item of arr) {
    const stockCode = (item.stock_code ?? "").toString().trim();
    const corpCode = (item.corp_code ?? "").toString().trim();
    if (stockCode && corpCode) map.set(stockCode, corpCode);
  }
  corpCodeMap = map;
  corpCodeFetchedAt = now;
  return map;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Recent DART disclosures for a stock code, most-recent first. Returns [] if no key configured or on any failure. */
export async function getDisclosures(stockCode: string, days = 14): Promise<SourceItem[]> {
  const key = apiKey();
  if (!key) return [];
  try {
    const map = await loadCorpCodeMap();
    const corpCode = map.get(stockCode);
    if (!corpCode) return [];

    const end = new Date();
    const begin = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      crtfc_key: key,
      corp_code: corpCode,
      bgn_de: fmtDate(begin),
      end_de: fmtDate(end),
      page_count: "15",
      sort: "date",
      sort_mth: "desc",
    });
    const res = await fetch(`${LIST_URL}?${params.toString()}`);
    if (!res.ok) return [];
    const json: any = await res.json();
    if (json.status !== "000" || !Array.isArray(json.list)) return [];

    return json.list.map((item: any): SourceItem => ({
      type: "disclosure",
      title: `${item.report_nm ?? "공시"}`.trim(),
      url: item.rcept_no
        ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`
        : undefined,
      publishedAt: item.rcept_dt,
      snippet: `${item.corp_name ?? ""} · ${item.flr_nm ?? ""}`.trim(),
    }));
  } catch (err) {
    console.warn("[dart] disclosure lookup failed:", (err as Error).message);
    return [];
  }
}
