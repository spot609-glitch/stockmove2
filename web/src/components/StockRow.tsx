import type { AnalyzedStock } from "../types";

interface Props {
  stock: AnalyzedStock;
  direction: "up" | "down";
  onClick: () => void;
}

export function StockRow({ stock, direction, onClick }: Props) {
  const pct = stock.changePct ?? 0;
  const sign = pct > 0 ? "+" : "";
  return (
    <li className={`stock-row row-${direction}`} onClick={onClick}>
      <span className="row-name">{stock.name}</span>
      <span className="row-pct">
        {sign}
        {pct.toFixed(1)}%
      </span>
      <span className="row-cause">
        {stock.causeLoading ? (
          <span className="cause-loading">원인 조사 중…</span>
        ) : (
          stock.cause?.cause ?? "-"
        )}
      </span>
    </li>
  );
}
