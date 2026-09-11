import { useEffect, useRef, useState } from "react";
import type { StockInfo } from "../types";
import { searchStocks } from "../lib/api";
import { MAX_WATCHLIST } from "../lib/storage";

interface Props {
  watchlist: StockInfo[];
  onAdd: (stock: StockInfo) => void;
  onRemove: (code: string) => void;
  onClose: () => void;
}

export function WatchlistEditor({ watchlist, onAdd, onRemove, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StockInfo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchStocks(query);
        setSuggestions(results.filter((r) => !watchlist.some((w) => w.code === r.code)));
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, watchlist]);

  function handleAdd(stock: StockInfo) {
    if (watchlist.length >= MAX_WATCHLIST) {
      setErrorMsg(`관심종목은 최대 ${MAX_WATCHLIST}개까지 등록할 수 있습니다.`);
      return;
    }
    if (watchlist.some((w) => w.code === stock.code)) {
      setErrorMsg("이미 등록된 종목입니다.");
      return;
    }
    setErrorMsg(null);
    onAdd(stock);
    setQuery("");
    setSuggestions([]);
  }

  return (
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-panel" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <h2>관심종목 편집</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="editor-count">
          관심종목 {watchlist.length} / {MAX_WATCHLIST}
        </div>

        <div className="editor-search">
          <input
            autoFocus
            type="text"
            placeholder="종목명 또는 종목코드 입력 (예: 삼성전자, 005930)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="editor-suggestions">
              {suggestions.map((s) => (
                <li key={s.code}>
                  <button onClick={() => handleAdd(s)}>
                    <span className="sug-name">{s.name}</span>
                    <span className="sug-code">{s.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {errorMsg && <div className="editor-error">{errorMsg}</div>}

        <ul className="editor-list">
          {watchlist.length === 0 && <li className="editor-empty">등록된 관심종목이 없습니다.</li>}
          {watchlist.map((s) => (
            <li key={s.code}>
              <span className="item-name">{s.name}</span>
              <span className="item-code">{s.code}</span>
              <button className="remove-btn" onClick={() => onRemove(s.code)} aria-label={`${s.name} 삭제`}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
