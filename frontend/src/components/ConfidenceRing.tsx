import { motion } from "framer-motion";

export function ConfidenceRing({ value }: { value: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.max(0, Math.min(1, value));
  return (
    <div className="confidence-ring" aria-label={`${Math.round(percent * 100)} percent confidence`}>
      <svg viewBox="0 0 76 76" role="img" aria-hidden="true">
        <circle className="ring-track" cx="38" cy="38" r={radius} />
        <motion.circle
          className="ring-value"
          cx="38"
          cy="38"
          r={radius}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - percent) }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <span>{Math.round(percent * 100)}<small>%</small></span>
    </div>
  );
}
