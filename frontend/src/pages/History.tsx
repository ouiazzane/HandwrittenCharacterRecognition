import { useState } from "react";
import { motion } from "framer-motion";
import { Download, History as HistoryIcon, Trash2 } from "lucide-react";
import { clearHistory, readHistory } from "../lib/history";
import { GlassCard } from "../components/GlassCard";
import type { HistoryEntry } from "../types";
import type { Notify } from "../App";

export default function History({ notify }: { notify: Notify }) {
  const [entries, setEntries] = useState<HistoryEntry[]>(readHistory);

  const remove = (id: string) => {
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    localStorage.setItem("charvision-history", JSON.stringify(next));
  };

  const exportCsv = () => {
    if (!entries.length) return;
    const rows = [["timestamp", "character", "confidence"], ...entries.map((entry) => [
      entry.timestamp,
      `"${entry.char.replace(/"/g, '""')}"`,
      (entry.confidence * 100).toFixed(2),
    ])];
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "charvision-history.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Recognition history exported.", "success");
  };

  const clearAll = () => {
    clearHistory();
    setEntries([]);
  };

  return (
    <motion.div className="page-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <div className="page-intro">
        <div>
          <div className="section-kicker"><span className="kicker-line" /> YOUR SESSION <span className="kicker-dot">04</span></div>
          <h1>A trail of <span>guesses.</span></h1>
          <p>Your last 20 recognitions are saved locally in this browser.</p>
        </div>
        <div className="history-actions">
          <button className="button button-outline" disabled={!entries.length} onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="button button-quiet danger-action" disabled={!entries.length} onClick={clearAll}><Trash2 size={16} /> Clear all</button>
        </div>
      </div>

      {entries.length ? (
        <div className="history-grid">
          {entries.map((entry, index) => (
            <motion.article className="history-item glass-card" key={entry.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }}>
              <div className="history-thumb"><img src={entry.thumbnail} alt={`Drawing recognized as ${entry.char}`} /></div>
              <div className="history-prediction">
                <span className="history-character">{entry.char}</span>
                <span className="history-confidence">{(entry.confidence * 100).toFixed(1)}% confidence</span>
              </div>
              <div className="history-item-bottom">
                <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                <button onClick={() => remove(entry.id)} aria-label={`Delete recognition ${entry.char}`}><Trash2 size={15} /></button>
              </div>
            </motion.article>
          ))}
        </div>
      ) : (
        <GlassCard className="empty-history">
          <div className="empty-icon"><HistoryIcon size={28} /></div>
          <h2>Nothing in the archive yet</h2>
          <p>Recognized characters will appear here after your first drawing.</p>
          <span>PRIVATE BY DESIGN · STORED ON THIS DEVICE</span>
        </GlassCard>
      )}
      <p className="privacy-footnote"><span /> History lives in localStorage and never leaves this browser.</p>
    </motion.div>
  );
}
