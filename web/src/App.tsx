import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { ResultPanel } from "./components/ResultPanel";
import { WatchlistEditor } from "./components/WatchlistEditor";
import { DetailView } from "./components/DetailView";
import { analyzeCauses, fetchConfig, fetchQuotes } from "./lib/api";
import { loadThreshold, loadWatchlist, saveThreshold, saveWatchlist } from "./lib/storage";
import type { AnalyzedStock, QuoteResult, ServerConfig, StockInfo } from "./types";
import "./App.css";

export default function App() {
  const [watchlist, setWatchlist] = useState<StockInfo[]>(() => loadWatchlist());
  const [threshold, setThreshold] = useState<number>(() => loadThreshold());
  const [editorOpen, setEditorOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [surge, setSurge] = useState<AnalyzedStock[]>([]);
  const [plunge, setPlunge] = useState<AnalyzedStock[]>([]);
  const [priceErrors, setPriceErrors] = useState<QuoteResult[]>([]);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AnalyzedStock | null>(null);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => saveWatchlist(watchlist), [watchlist]);
  useEffect(() => saveThreshold(threshold), [threshold]);

  function handleAdd(stock: StockInfo) {
    setWatchlist((prev) => [...prev, stock]);
  }

  function handleRemove(code: string) {
    setWatchlist((prev) => prev.filter((s) => s.code !== code));
  }

  async function handleAnalyze() {
    if (watchlist.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setPriceErrors([]);
    try {
      const quotes = await fetchQuotes(watchlist);
      const errors = quotes.filter((q) => q.error || q.changePct === null);
      const valid = quotes.filter((q): q is QuoteResult & { changePct: number } => q.changePct !== null);
      const hits = valid.filter((q) => Math.abs(q.changePct) >= threshold);

      const up = hits
        .filter((q) => q.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct)
        .map((q): AnalyzedStock => ({ ...q, causeLoading: true }));
      const down = hits
        .filter((q) => q.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct)
        .map((q): AnalyzedStock => ({ ...q, causeLoading: true }));

      setSurge(up);
      setPlunge(down);
      setPriceErrors(errors);
      setHasAnalyzed(true);
      setAnalyzing(false);

      if (hits.length === 0) return;

      try {
        const targets = hits.map((q) => ({ code: q.code, name: q.name, changePct: q.changePct }));
        const causes = await analyzeCauses(targets);
        const byCode = new Map(causes.map((c) => [c.code, c]));
        setSurge((prev) =>
          prev.map((s) => ({ ...s, cause: byCode.get(s.code), causeLoading: false }))
        );
        setPlunge((prev) =>
          prev.map((s) => ({ ...s, cause: byCode.get(s.code), causeLoading: false }))
        );
      } catch (err) {
        setAnalyzeError((err as Error).message || "원인 조사 중 오류가 발생했습니다");
        setSurge((prev) => prev.map((s) => ({ ...s, causeLoading: false })));
        setPlunge((prev) => prev.map((s) => ({ ...s, causeLoading: false })));
      }
    } catch (err) {
      setAnalyzeError((err as Error).message || "가격 조회 중 오류가 발생했습니다");
      setAnalyzing(false);
    }
  }

  function handleSelect(stock: AnalyzedStock) {
    setSelected(stock);
  }

  // Keep the open detail panel's data fresh as async cause results stream in.
  useEffect(() => {
    if (!selected) return;
    const updated = [...surge, ...plunge].find((s) => s.code === selected.code);
    if (updated && updated !== selected) setSelected(updated);
  }, [surge, plunge, selected]);

  return (
    <div className="app-shell">
      <Header
        watchlistCount={watchlist.length}
        threshold={threshold}
        onThresholdChange={setThreshold}
        onEditClick={() => setEditorOpen(true)}
        onAnalyzeClick={handleAnalyze}
        analyzing={analyzing}
      />

      {config && !config.aiEnabled && (
        <div className="status-banner">
          AI 원인 요약이 비활성화되어 있습니다. 서버에 ANTHROPIC_API_KEY를 설정하면 핵심 원인을 자동 요약합니다. (현재는 검색된 원문 자료만 표시됩니다)
        </div>
      )}
      {analyzeError && <div className="status-banner banner-error">{analyzeError}</div>}
      {priceErrors.length > 0 && (
        <div className="status-banner banner-warn">
          가격 조회 실패: {priceErrors.map((e) => e.name).join(", ")}
        </div>
      )}

      <main className="results-grid">
        <ResultPanel
          title="급등 종목"
          icon="🔺"
          direction="up"
          stocks={surge}
          onSelect={handleSelect}
          emptyLabel={hasAnalyzed ? "기준 이상 급등한 종목이 없습니다." : "관심종목 분석 버튼을 눌러 시작하세요."}
        />
        <ResultPanel
          title="급락 종목"
          icon="🔻"
          direction="down"
          stocks={plunge}
          onSelect={handleSelect}
          emptyLabel={hasAnalyzed ? "기준 이상 급락한 종목이 없습니다." : "관심종목 분석 버튼을 눌러 시작하세요."}
        />
      </main>

      {editorOpen && (
        <WatchlistEditor
          watchlist={watchlist}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {selected && <DetailView stock={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
