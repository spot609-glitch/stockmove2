export interface StockInfo {
  code: string;
  name: string;
  market?: string;
}

export interface QuoteResult {
  code: string;
  name: string;
  currentPrice: number | null;
  prevClose: number | null;
  changePct: number | null;
  error?: string;
}

export type SourceType =
  | "disclosure" // 기업 공식 공시 (DART)
  | "company" // 회사 공식 발표
  | "news_kr" // 국내 주요 경제 뉴스
  | "news_industry" // 관련 산업 뉴스
  | "news_global" // 해외 주요 뉴스
  | "competitor" // 경쟁사 뉴스
  | "supply_chain" // 공급망 관련 뉴스
  | "community_kr" // 국내 투자 커뮤니티
  | "community_global" // 해외 투자 커뮤니티
  | "sns"; // 공개 SNS

export interface SourceItem {
  type: SourceType;
  title: string;
  url?: string;
  publishedAt?: string;
  snippet?: string;
}

export type Confidence = "high" | "medium" | "low" | "unknown";

export interface CauseResult {
  code: string;
  cause: string;
  confidence: Confidence;
  summary: string;
  sources: SourceItem[];
  note?: string;
  aiEnabled: boolean;
}
