import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { ToastKind } from "../types";

export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}

export function Toasts({ items, dismiss }: { items: ToastMessage[]; dismiss: (id: number) => void }) {
  const icons = { error: AlertCircle, success: CheckCircle2, info: Info };
  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence>
        {items.map((toast) => {
          const Icon = icons[toast.kind];
          return (
            <motion.div
              className={`toast toast-${toast.kind}`}
              key={toast.id}
              initial={{ opacity: 0, x: 28, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              role="status"
            >
              <Icon size={18} />
              <span>{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><X size={15} /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
