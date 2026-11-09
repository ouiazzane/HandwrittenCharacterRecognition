import { motion } from "framer-motion";
import type { Prediction } from "../types";

export function PredictionBars({ predictions }: { predictions: Prediction[] }) {
  return (
    <div className="prediction-list">
      {predictions.map((item, index) => (
        <div className="prediction-row" key={`${item.char}-${index}`}>
          <span className={`prediction-rank ${index === 0 ? "rank-primary" : ""}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="prediction-char">{item.char}</span>
          <div className="prediction-track">
            <motion.div
              className={`prediction-fill ${index === 0 ? "fill-primary" : ""}`}
              initial={{ width: 0 }}
              animate={{ width: `${item.probability * 100}%` }}
              transition={{ duration: 0.75, delay: index * 0.1, ease: "easeOut" }}
            />
          </div>
          <span className="prediction-percent">{(item.probability * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
