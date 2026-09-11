import type { AnalyzedStock, SourceType } from "../types";

interface Props {
  stock: AnalyzedStock;
  onClose: () => void;
}

const SOURCE_LABEL: Record<SourceType, string> = {
  disclosure: "기업 공시",
  company: "회사 발표",
  news_kr: "국내 뉴스",
  news_industry: "산업 뉴스",
  news_global: "해외 뉴스",
  competitor: "경쟁사 뉴스",
  supply_chain: "공급망 뉴스",
  community_kr: "국내 커뮤니티",
  community_global: "해외 커뮤니티",
  sns: "SNS",
};

const UNCONFIRMED_TAG: Partial<Record<SourceType, string>> = {
  community_kr: "시장 추정",
  community_global: "시장 추정",
  sns: "미확인 정보",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
  unknown: "확인 필요",
};

export function DetailView({ stock, onClose }: Props) {
  const pct = stock.changePct ?? 0;
  const sign = pct > 0 ? "+" : "";
  const cause = stock.cause;

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn detail-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <div className="detail-title">
          <h2>{stock.name}</h2>
          <span className={`detail-pct ${pct >= 0 ? "pct-up" : "pct-down"}`}>
            {sign}
            {pct.toFixed(2)}%
          </span>
        </div>
        <div className="detail-meta">
          {stock.code} · 현재가 {stock.currentPrice?.toLocaleString() ?? "-"}원 · 전일종가{" "}
          {stock.prevClose?.toLocaleString() ?? "-"}원
        </div>

        {stock.causeLoading || !cause ? (
          <div className="detail-loading">원인 조사 중…</div>
        ) : (
          <>
            <section className="detail-section">
              <h3>핵심 원인</h3>
              <div className="detail-cause">{cause.cause}</div>
            </section>

            <section className="detail-section">
              <h3>
                상세 분석
                <span className={`confidence-badge conf-${cause.confidence}`}>
                  신뢰도 {CONFIDENCE_LABEL[cause.confidence]}
                </span>
              </h3>
              <p className="detail-summary">{cause.summary}</p>
              {cause.note && <p className="detail-note">{cause.note}</p>}
            </section>

            <section className="detail-section">
              <h3>원인 근거 ({cause.sources.length})</h3>
              {cause.sources.length === 0 ? (
                <div className="detail-empty-sources">검색된 근거 자료가 없습니다.</div>
              ) : (
                <ul className="source-list">
                  {cause.sources.map((s, i) => (
                    <li key={i} className="source-item">
                      <div className="source-row1">
                        <span className="source-type">{SOURCE_LABEL[s.type]}</span>
                        {UNCONFIRMED_TAG[s.type] && (
                          <span className="source-unconfirmed">{UNCONFIRMED_TAG[s.type]}</span>
                        )}
                        {s.publishedAt && <span className="source-date">{s.publishedAt}</span>}
                      </div>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="source-title">
                          {s.title}
                        </a>
                      ) : (
                        <span className="source-title">{s.title}</span>
                      )}
                      {s.snippet && <p className="source-snippet">{s.snippet}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
