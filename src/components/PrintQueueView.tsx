import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  FilePlus2,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import {
  b5Layouts,
  b5Papers,
  formatPrice,
  isB5Paper,
  type Paper,
} from "../lib/model";
import { buildPrintSheets, type PrintEntry } from "../lib/print";
import PrintSheetPreview from "./PrintSheetPreview";
import CopiesInput from "./CopiesInput";

type QueueChange = Partial<Pick<PrintEntry, "copies">> & { paper?: Paper };

export interface PrintQueueViewProps {
  entries: PrintEntry[];
  onChange: (entryId: string, patch: QueueChange) => void;
  onRemove: (id: string) => void;
  onEdit: (entry: PrintEntry) => void;
  onNew: () => void;
  onPrint: () => void;
}

function paperLabel(paper: Paper): string {
  return isB5Paper(paper)
    ? b5Layouts[paper].label
    : paper === "shelf"
      ? "棚札（旧サイズ）"
      : `${paper}（旧サイズ）`;
}

export default function PrintQueueView({
  entries,
  onChange,
  onRemove,
  onEdit,
  onNew,
  onPrint,
}: PrintQueueViewProps) {
  const [page, setPage] = useState(0);
  const sheets = useMemo(
    () => (entries.length ? buildPrintSheets(entries) : []),
    [entries],
  );
  const popCount = entries.reduce((count, entry) => count + entry.copies, 0);
  const currentPage = Math.min(page, Math.max(0, sheets.length - 1));
  const sheet = sheets[currentPage];

  return (
    <motion.main
      className="queue-main"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.23 }}
    >
      <div className="queue-heading">
        <div>
          <h1>
            印刷待ち <span>{entries.length}</span>
          </h1>
          <p>
            {entries.length}商品 <i /> POP {popCount}枚 <i /> 用紙{" "}
            {sheets.length}枚
          </p>
        </div>
        <div className="queue-heading-actions">
          <button className="secondary-button" onClick={onNew}>
            <Plus size={17} />
            次の商品を入力
          </button>
          <button
            className="primary-button"
            onClick={onPrint}
            disabled={entries.length === 0}
          >
            <Printer size={17} />
            まとめて印刷
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <section className="queue-empty">
          <span className="queue-empty-icon">
            <Printer size={28} />
          </span>
          <h2>印刷待ちのPOPはありません</h2>
          <p>商品を入力して「印刷待ちに追加」を押してください。</p>
          <button className="primary-button" onClick={onNew}>
            <FilePlus2 size={17} />
            商品を入力
          </button>
        </section>
      ) : (
        <div className="queue-layout">
          <section className="queue-list-panel" aria-label="印刷待ちの商品">
            <div className="queue-section-heading">
              <h2>商品一覧</h2>
              <span>{entries.length}商品</span>
            </div>
            <p className="queue-storage-note">
              追加した時点の内容を、この端末に保存しています。
            </p>
            <div className="queue-list">
              {entries.map((entry, index) => (
                <motion.article
                  className="queue-row"
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="queue-row-top">
                    <span className="queue-row-number">{index + 1}</span>
                    <div className="queue-product">
                      <h3>{entry.doc.productName}</h3>
                      <p>
                        {[entry.doc.origin, entry.doc.unit]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </p>
                    </div>
                    <strong className="queue-price">
                      {formatPrice(entry.doc.price)}
                      <small>円</small>
                    </strong>
                  </div>
                  <div className="queue-row-controls">
                    <label className="queue-size-field">
                      <span>POPサイズ</span>
                      <select
                        aria-label={`${entry.doc.productName}のPOPサイズ`}
                        value={entry.doc.paper}
                        onChange={(event) =>
                          onChange(entry.id, {
                            paper: event.target.value as Paper,
                          })
                        }
                      >
                        {!isB5Paper(entry.doc.paper) ? (
                          <option value={entry.doc.paper}>
                            {paperLabel(entry.doc.paper)}
                          </option>
                        ) : null}
                        {b5Papers.map((paper) => (
                          <option key={paper} value={paper}>
                            {b5Layouts[paper].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="queue-copies-field">
                      <span>POPの枚数</span>
                      <CopiesInput
                        aria-label={`${entry.doc.productName}のPOPの枚数`}
                        value={entry.copies}
                        onChange={(copies) => onChange(entry.id, { copies })}
                      />
                    </label>
                    <div className="queue-row-actions">
                      <button
                        className="queue-icon-button"
                        title="内容を編集"
                        aria-label={`${entry.doc.productName}の内容を編集`}
                        onClick={() => onEdit(entry)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="queue-icon-button queue-remove"
                        title="印刷待ちから外す"
                        aria-label={`${entry.doc.productName}を印刷待ちから外す`}
                        onClick={() => onRemove(entry.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>

          {sheet ? (
            <section
              className="queue-preview-panel"
              aria-label="面付けプレビュー"
            >
              <div className="queue-section-heading">
                <h2>面付けプレビュー</h2>
                <span>用紙 {sheets.length}枚</span>
              </div>
              <div className="queue-sheet-info">
                <strong>{paperLabel(sheet.paper)}</strong>
                <span>
                  {isB5Paper(sheet.paper)
                    ? "B5"
                    : sheet.paper === "shelf"
                      ? "棚札"
                      : sheet.paper}
                  ・{sheet.orientation === "portrait" ? "縦" : "横"}・
                  {sheet.columns * sheet.rows}面
                </span>
              </div>
              <div className="queue-paper-stage">
                {/* Swap sheets immediately: a fade-out/fade-in ("wait") left the
                    stage empty between pages, for longer on slow or busy PCs. */}
                <div
                  className={`queue-paper-wrap ${sheet.orientation === "portrait" ? "queue-paper-portrait" : ""}`}
                >
                  <PrintSheetPreview sheet={sheet} />
                </div>
              </div>
              <div className="queue-page-controls">
                <button
                  className="queue-icon-button"
                  aria-label="前の用紙"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ArrowLeft size={16} />
                </button>
                <span aria-live="polite">
                  {currentPage + 1} / {sheets.length} ページ
                </span>
                <button
                  className="queue-icon-button"
                  aria-label="次の用紙"
                  disabled={currentPage === sheets.length - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
              <p className="queue-preview-note">
                同じサイズの商品をまとめて配置します。空き枠は印刷されません。
              </p>
              <div className="queue-print-note">
                <Printer size={17} />
                <p>
                  印刷は倍率100%・余白なし。B5は「JIS B5」を選んでください。
                </p>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </motion.main>
  );
}
