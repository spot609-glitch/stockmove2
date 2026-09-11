import Anthropic from "@anthropic-ai/sdk";
import type { CauseResult, Confidence, SourceItem, StockInfo } from "../types.js";
import { getDisclosures } from "./dart.js";
import {
  getDomesticNews,
  getGlobalNews,
  getDomesticNewsFallback,
  getDomesticCommunity,
  getGlobalCommunity,
} from "./newsSources.js";

const SOURCE_LABEL: Record<SourceItem["type"], string> = {
  disclosure: "기업 공식 공시(DART)",
  company: "회사 공식 발표",
  news_kr: "국내 주요 경제 뉴스",
  news_industry: "관련 산업 뉴스",
  news_global: "해외 주요 뉴스",
  competitor: "경쟁사 뉴스",
  supply_chain: "공급망 관련 뉴스",
  community_kr: "국내 투자 커뮤니티",
  community_global: "해외 투자 커뮤니티",
  sns: "공개 SNS",
};

function anthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

async function gatherSources(stock: StockInfo): Promise<SourceItem[]> {
  const [disclosures, domesticNews, globalNews, domesticCommunity, globalCommunity] =
    await Promise.all([
      getDisclosures(stock.code),
      getDomesticNews(stock.name),
      getGlobalNews(stock.name),
      getDomesticCommunity(stock.name),
      getGlobalCommunity(stock.name),
    ]);

  const sources = [...disclosures, ...domesticNews, ...globalNews, ...domesticCommunity, ...globalCommunity];

  // If everything came back empty (e.g. Naver key missing AND Google RSS blocked), try one more
  // keyless fallback so the user isn't left with a totally blank source list.
  if (sources.length === 0) {
    const fallback = await getDomesticNewsFallback(stock.name);
    sources.push(...fallback);
  }
  return sources;
}

function isUnconfirmedType(type: SourceItem["type"]): boolean {
  return type === "community_kr" || type === "community_global" || type === "sns";
}

function fallbackWithoutAi(stock: StockInfo, sources: SourceItem[]): CauseResult {
  const officialOrNews = sources.filter((s) => !isUnconfirmedType(s.type));
  const top = officialOrNews[0] ?? sources[0];
  const hasLead = Boolean(top);
  return {
    code: stock.code,
    cause: hasLead ? "직접 확인 필요" : "특이사항 없음",
    confidence: "unknown",
    summary: hasLead
      ? `AI 원인 요약 기능이 설정되지 않아 자동 요약을 제공할 수 없습니다. 검색된 자료 중 가장 최신 항목은 "${top.title}"(${SOURCE_LABEL[top.type]})입니다. 아래 출처 목록에서 원문을 직접 확인해 주세요.`
      : `관련 공시, 뉴스, 산업뉴스, 커뮤니티, SNS에서 확인 가능한 이슈를 찾지 못했습니다. (참고: ANTHROPIC_API_KEY가 설정되지 않아 AI 요약 없이 검색 결과만 표시됩니다.)`,
    sources,
    note: "AI 요약 비활성화: 서버에 ANTHROPIC_API_KEY를 설정하면 자동으로 핵심 원인을 요약합니다.",
    aiEnabled: false,
  };
}

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001";

async function summarizeWithAi(
  stock: StockInfo,
  changePct: number,
  sources: SourceItem[]
): Promise<CauseResult> {
  const client = anthropicClient();
  if (!client) return fallbackWithoutAi(stock, sources);
  if (sources.length === 0) {
    return {
      code: stock.code,
      cause: "특이사항 없음",
      confidence: "unknown",
      summary: "관련 공시, 뉴스, 산업뉴스, 커뮤니티, SNS에서 확인 가능한 자료를 찾지 못했습니다.",
      sources: [],
      aiEnabled: true,
    };
  }

  const materials = sources
    .map((s, i) => {
      const parts = [
        `[${i}] 구분: ${SOURCE_LABEL[s.type]}`,
        `제목: ${s.title}`,
        s.publishedAt ? `날짜: ${s.publishedAt}` : null,
        s.snippet ? `요약: ${s.snippet}` : null,
      ].filter(Boolean);
      return parts.join(" / ");
    })
    .join("\n");

  const direction = changePct >= 0 ? "급등" : "급락";

  const prompt = `당신은 한국 주식시장 애널리스트입니다. 아래는 "${stock.name}"(${stock.code}) 종목이 전일 종가 대비 ${changePct.toFixed(
    2
  )}% ${direction}한 것과 관련하여 실제로 검색된 자료 목록입니다.

반드시 아래 자료에서 확인되는 사실에만 근거해서 답하세요. 자료에 없는 내용을 추측하거나 지어내지 마세요. 여러 자료가 같은 사건을 가리키면 그 사건을 핵심 원인으로 선택하세요. 명확한 원인이 확인되지 않으면 cause를 정확히 "특이사항 없음"으로 답하세요.

신뢰도 우선순위: 공시 > 회사 발표 > 주요 언론 > 산업 전문 언론 > 다수 언론 보도 > 커뮤니티 > SNS. 근거가 커뮤니티/SNS 자료뿐이라면 confidence는 반드시 "low"로 하고 summary에 "시장 추정" 또는 "미확인 정보"임을 명시하세요.

자료 목록:
${materials}

다음 JSON 형식으로만, 다른 설명 없이 답하세요:
{
  "cause": "한국어 3단어 이내 핵심 원인 (또는 특이사항 없음)",
  "confidence": "high" | "medium" | "low",
  "summary": "2~4문장의 한국어 설명. 반드시 위 자료 내용에 근거.",
  "usedSourceIndexes": [사용한 자료의 번호들]
}`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON in AI response");
    const parsed = JSON.parse(jsonMatch[0]);

    let cause: string = String(parsed.cause ?? "특이사항 없음").trim();
    const wordCount = cause.split(/\s+/).filter(Boolean).length;
    if (wordCount > 3) cause = cause.split(/\s+/).slice(0, 3).join(" ");

    let confidence: Confidence = ["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "unknown";
    if (cause === "특이사항 없음") confidence = "unknown";

    const usedIdx: number[] = Array.isArray(parsed.usedSourceIndexes)
      ? parsed.usedSourceIndexes.filter((n: unknown) => typeof n === "number")
      : [];
    const onlyUnconfirmed =
      usedIdx.length > 0 && usedIdx.every((i) => isUnconfirmedType(sources[i]?.type));

    let summary: string = String(parsed.summary ?? "").trim();
    if (onlyUnconfirmed && !/시장 추정|미확인 정보/.test(summary)) {
      summary += " (커뮤니티/SNS 기반 정보로, 시장 추정 또는 미확인 정보입니다.)";
    }

    return {
      code: stock.code,
      cause,
      confidence,
      summary: summary || "자료에서 뚜렷한 원인이 확인되지 않았습니다.",
      sources,
      aiEnabled: true,
    };
  } catch (err) {
    console.warn("[analyze] AI summarization failed:", (err as Error).message);
    return {
      ...fallbackWithoutAi(stock, sources),
      note: "AI 요약 호출에 실패하여 검색 결과만 표시합니다.",
      aiEnabled: true,
    };
  }
}

export async function investigateCause(stock: StockInfo, changePct: number): Promise<CauseResult> {
  const sources = await gatherSources(stock);
  return summarizeWithAi(stock, changePct, sources);
}
