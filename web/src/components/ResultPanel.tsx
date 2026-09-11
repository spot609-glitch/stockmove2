import type { AnalyzedStock } from "../types";
import { StockRow } from "./StockRow";

interface Props {
  title: string;
  icon: string;
  direction: "up" | "down";
  stocks: AnalyzedStock[];
  onSelect: (stock: AnalyzedStock) => void;
  emptyLabel: string;
}

export function ResultPanel({ title, icon, direction, stocks, onSelect, emptyLabel }: Props) {
  return (
    <section className={`result-panel panel-${direction}`}>
      <header className="panel-header">
        <span className="panel-icon">{icon}</span>
        <span>{title}</span>
        <span className="panel-count">{stocks.length}</span>
      </header>
      {stocks.length === 0 ? (
        <div className="panel-empty">{emptyLabel}</div>
      ) : (
        <ul className="stock-list">
          {stocks.map((s) => (
            <StockRow key={s.code} stock={s} direction={direction} onClick={() => onSelect(s)} />
          ))}
        </ul>
      )}
    </section>
  );
}
