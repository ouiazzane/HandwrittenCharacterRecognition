import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Brush, Clock3, Moon, ScanLine, Sun, WholeWord } from "lucide-react";
import Recognize from "./pages/Recognize";
import Performance from "./pages/Performance";
import History from "./pages/History";
import WordMode from "./pages/WordMode";
import { Toasts, type ToastMessage } from "./components/Toast";
import { useTheme } from "./hooks/useTheme";
import type { PageName, ToastKind } from "./types";
import { getHealth } from "./api/client";

export type Notify = (message: string, kind?: ToastKind) => void;

const pages: { id: PageName; label: string; icon: typeof Brush }[] = [
  { id: "recognize", label: "Recognize", icon: Brush },
  { id: "word", label: "Word mode", icon: WholeWord },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "history", label: "History", icon: Clock3 },
];

const API_OFFLINE_MESSAGE = "The backend is not reachable or another service is running on this port. Start this project's API with: uvicorn api:app --reload --port 8010";

export default function App() {
  const [page, setPage] = useState<PageName>("recognize");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const health = await getHealth();
        if (active) {
          setApiOnline(
            health.app === "CharVision AI" &&
            health.status === "ok" &&
            health.model_loaded &&
            health.classes === 47,
          );
        }
      } catch {
        if (active) setApiOnline(false);
      }
    };
    void checkHealth();
    const intervalId = window.setInterval(() => void checkHealth(), 10_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const notify = useCallback<Notify>((message, kind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, kind }]);
    window.setTimeout(() => setToasts((items) => items.filter((toast) => toast.id !== id)), 5800);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  return (
    <div className="app-shell">
      <div className="ambient ambient-violet" />
      <div className="ambient ambient-cyan" />
      <header className="topbar">
        <button className="brand-lockup" onClick={() => setPage("recognize")} aria-label="CharVision AI home">
          <span className="brand-mark"><ScanLine size={21} strokeWidth={2} /></span>
          <span><strong>CharVision<span>AI</span></strong><small>HANDWRITING LAB</small></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {pages.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)} className={`nav-link ${page === id ? "nav-active" : ""}`} aria-current={page === id ? "page" : undefined}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
              {page === id && <motion.i className="nav-indicator" layoutId="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <span className={`api-status ${apiOnline ? "api-status-online" : "api-status-offline"}`} role="status" aria-live="polite">
            <i /> API {apiOnline ? "online" : "offline"}
          </span>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <main className="main-content">
        {!apiOnline && <div className="backend-warning" role="alert">{API_OFFLINE_MESSAGE}</div>}
        <AnimatePresence mode="wait">
          <motion.div key={page} className="page-transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {page === "recognize" && <Recognize notify={notify} apiOnline={apiOnline} />}
            {page === "word" && <WordMode notify={notify} apiOnline={apiOnline} />}
            {page === "performance" && <Performance notify={notify} />}
            {page === "history" && <History notify={notify} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="site-footer">
        <span className="footer-brand"><span className="footer-mark">C.</span> CHARVISION AI <i /> EDUCATIONAL PROJECT</span>
        <span>Trained on EMNIST balanced <i /> about 90% test accuracy <i /> <a href="http://localhost:8010/docs" target="_blank" rel="noreferrer">API docs ↗</a></span>
      </footer>
      <Toasts items={toasts} dismiss={dismiss} />
    </div>
  );
}
