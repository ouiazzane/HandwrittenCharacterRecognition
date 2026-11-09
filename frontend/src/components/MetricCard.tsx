import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  format: (value: number) => string;
  icon: LucideIcon;
  accent: string;
  detail: string;
}

export function MetricCard({ label, value, format, icon: Icon, accent, detail }: MetricCardProps) {
  const source = useMotionValue(0);
  const spring = useSpring(source, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (current) => format(current));
  useEffect(() => {
    source.set(value);
  }, [source, value]);

  return (
    <motion.div className="metric-card glass-card" whileHover={{ y: -4 }}>
      <div className="metric-top">
        <span className="metric-icon" style={{ color: accent, backgroundColor: `${accent}18` }}><Icon size={18} /></span>
        <span className="metric-live"><i /> MODEL DATA</span>
      </div>
      <p className="metric-label">{label}</p>
      <motion.p className="metric-value">{display}</motion.p>
      <p className="metric-detail">{detail}</p>
    </motion.div>
  );
}
