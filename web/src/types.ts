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
  | "disclosure"
  | "company"
  | "news_kr"
  | "news_industry"
  | "news_global"
  | "competitor"
  | "supply_chain"
  | "community_kr"
  | "community_global"
  | "sns";

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

export interface AnalyzedStock extends QuoteResult {
  cause?: CauseResult;
  causeLoading?: boolean;
}

export interface ServerConfig {
  dartEnabled: boolean;
  naverEnabled: boolean;
  aiEnabled: boolean;
}
