import { MAX_WATCHLIST, THRESHOLD_OPTIONS } from "../lib/storage";

interface Props {
  watchlistCount: number;
  threshold: number;
  onThresholdChange: (t: number) => void;
  onEditClick: () => void;
  onAnalyzeClick: () => void;
  analyzing: boolean;
}

export function Header({
  watchlistCount,
  threshold,
  onThresholdChange,
  onEditClick,
  onAnalyzeClick,
  analyzing,
}: Props) {
  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">Stock Move Finder</h1>
        <span className="watch-count">
          관심종목 {watchlistCount} / {MAX_WATCHLIST}
        </span>
        <button className="edit-btn" onClick={onEditClick}>
          관심종목 편집
        </button>
      </div>
      <div className="header-right">
        <label className="threshold-label">
          기준 변동률
          <select
            value={threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
          >
            {THRESHOLD_OPTIONS.map((t) => (
              <option key={t} value={t}>
                ±{t}%
              </option>
            ))}
          </select>
        </label>
        <button
          className="analyze-btn"
          onClick={onAnalyzeClick}
          disabled={analyzing || watchlistCount === 0}
        >
          {analyzing ? "분석 중…" : "관심종목 분석"}
        </button>
      </div>
    </header>
  );
}
