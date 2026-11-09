import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, BrainCircuit, ChartNoAxesCombined, Cpu, Database, Eye, X } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getClassReport, getConfusions, getMetrics, getModelInfo } from "../api/client";
import { GlassCard } from "../components/GlassCard";
import { MetricCard } from "../components/MetricCard";
import type { ClassMetric, Confusion, Metrics, ModelInfo } from "../types";
import type { Notify } from "../App";

const GALLERY = [
  { title: "Confusion matrix", file: "confusion_matrix_emnist.png", caption: "Where the 47-class model gets mixed up" },
  { title: "Misclassified examples", file: "misclassified_examples.png", caption: "A closer look at challenging handwriting" },
  { title: "EMNIST training curves", file: "emnist_training_curves.png", caption: "Training and validation over time" },
  { title: "MNIST training curves", file: "mnist_training_curves.png", caption: "Digit model training progression" },
  { title: "Top confusions", file: "top_confusions_emnist.png", caption: "The most frequent class-level mix-ups" },
  { title: "Class distribution", file: "class_distribution.png", caption: "Examples across the balanced dataset" },
];

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const f1Color = (score: number) => score > 0.9 ? "#56d6a5" : score >= 0.75 ? "#f2bc69" : "#f17d88";

export default function Performance({ notify }: { notify: Notify }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [confusions, setConfusions] = useState<Confusion[]>([]);
  const [report, setReport] = useState<ClassMetric[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<(typeof GALLERY)[number] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getMetrics(), getModelInfo(), getConfusions(), getClassReport()])
      .then(([metricData, modelData, confusionData, reportData]) => {
        if (!active) return;
        setMetrics(metricData);
        setModel(modelData);
        setConfusions(confusionData);
        setReport(reportData);
      })
      .catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not load model metrics.", "error"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notify]);

  const classRows = useMemo(() => report
    .filter((row) => row.char.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.f1 - b.f1), [report, query]);

  const comparison = metrics ? [
    { dataset: "MNIST", accuracy: metrics.mnist.test_accuracy, f1: metrics.mnist.macro_f1 },
    { dataset: "EMNIST", accuracy: metrics.emnist_balanced.test_accuracy, f1: metrics.emnist_balanced.macro_f1 },
  ] : [];

  return (
    <motion.div className="page-content performance-page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <div className="page-intro">
        <div>
          <div className="section-kicker"><span className="kicker-line" /> MODEL TELEMETRY <span className="kicker-dot">03</span></div>
          <h1>Behind the <span>prediction.</span></h1>
          <p>Performance, class-level detail, and the data behind CharVision.</p>
        </div>
        <div className="model-status"><span className="status-pulse" /> VALIDATION SNAPSHOT <span className="status-divider">/</span> 2026</div>
      </div>

      <div className="metric-grid">
        {loading ? [0, 1, 2, 3].map((item) => <div className="metric-skeleton glass-card" key={item} />) : metrics && (
          <>
            <MetricCard label="EMNIST accuracy" value={metrics.emnist_balanced.test_accuracy * 100} format={(v) => `${v.toFixed(1)}%`} icon={Activity} accent="#b79bff" detail="47 balanced character classes" />
            <MetricCard label="Macro F1" value={metrics.emnist_balanced.macro_f1 * 100} format={(v) => `${v.toFixed(1)}%`} icon={ChartNoAxesCombined} accent="#62d9c3" detail="Equal weight for every class" />
            <MetricCard label="MNIST accuracy" value={metrics.mnist.test_accuracy * 100} format={(v) => `${v.toFixed(2)}%`} icon={Eye} accent="#7ca9ff" detail="10 handwritten digit classes" />
            <MetricCard label="Model parameters" value={metrics.emnist_balanced.parameters} format={(v) => `${Math.round(v / 1000)}k`} icon={Cpu} accent="#f1b879" detail={`${metrics.emnist_balanced.num_classes} output classes`} />
          </>
        )}
      </div>

      <div className="performance-charts">
        <GlassCard eyebrow="DATASET COMPARISON" title="Accuracy &amp; macro F1" className="comparison-card" action={<span className="chart-legend"><i className="legend-accuracy" /> Accuracy <i className="legend-f1" /> Macro F1</span>}>
          {loading ? <div className="chart-skeleton" /> : (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={comparison} margin={{ top: 16, right: 12, bottom: 0, left: -12 }} barGap={9}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="dataset" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis domain={[0, 1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <Tooltip formatter={(value: number) => percent(value)} contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--card-border)", borderRadius: 12, color: "var(--text)" }} />
                <Bar dataKey="accuracy" name="Accuracy" fill="#9d80ff" radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="f1" name="Macro F1" fill="#56d6c3" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="chart-footnote"><span><i /> Same CNN architecture, different datasets</span><span>EMNIST is a harder 47-class task</span></div>
        </GlassCard>

        <GlassCard eyebrow="CLASS BREAKDOWN" title="F1 by character" className="class-chart-card">
          <div className="class-chart-tools">
            <label className="search-field"><span className="sr-only">Filter classes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by character…" maxLength={3} /><kbd>/</kbd></label>
            <div className="class-legend"><span><i style={{ background: "#56d6a5" }} /> &gt; 0.90</span><span><i style={{ background: "#f2bc69" }} /> 0.75–0.90</span><span><i style={{ background: "#f17d88" }} /> &lt; 0.75</span></div>
          </div>
          {loading ? <div className="chart-skeleton" /> : classRows.length ? (
            <ResponsiveContainer width="100%" height={Math.max(300, classRows.length * 22)}>
              <BarChart data={classRows} layout="vertical" margin={{ top: 5, right: 32, bottom: 5, left: 3 }}>
                <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                <XAxis type="number" domain={[0, 1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <YAxis type="category" dataKey="char" width={26} tickLine={false} axisLine={false} tick={{ fill: "var(--text-soft)", fontSize: 11, fontWeight: 600 }} />
                <Tooltip formatter={(value: number) => percent(value)} labelFormatter={(label) => `Character ${label}`} contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--card-border)", borderRadius: 12, color: "var(--text)" }} />
                <Bar dataKey="f1" name="F1 score" radius={[0, 4, 4, 0]} maxBarSize={14} label={{ position: "right", formatter: (value: number) => `${Math.round(value * 100)}%`, fill: "var(--muted)", fontSize: 9 }}>
                  {classRows.map((row) => <Cell key={row.char} fill={f1Color(row.f1)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="class-empty">No character matches “{query}”.</div>}
          <p className="class-chart-note">Sorted from lowest to highest F1. The biggest challenge remains distinguishing similar-looking handwritten forms.</p>
        </GlassCard>
      </div>

      <GlassCard className="confusions-card" eyebrow="WHERE IT GETS TRICKY" title="Most frequent confusions" action={<span className="count-pill">{confusions.length} PAIRS</span>}>
        <p className="section-description">Some handwritten symbols share nearly identical shapes. These are the most common mix-ups in the EMNIST evaluation set.</p>
        <div className="confusions-list">
          {confusions.slice(0, 8).map((item, index) => (
            <div className="confusion-row" key={`${item.true}-${item.predicted}`}>
              <span className="confusion-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.true}</strong><span className="confusion-arrow">→</span><strong>{item.predicted}</strong>
              <div className="confusion-track"><i style={{ width: `${Math.min(Number(item.pct_of_true_class), 50) * 2}%` }} /></div>
              <span className="confusion-percent">{Number(item.pct_of_true_class).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="plain-language"><InfoDot /> <span>For example, about {confusions.find((item) => item.true === "F" && item.predicted === "f")?.pct_of_true_class ?? "—"}% of handwritten F examples were mistaken for f. A different writing style can change the model’s best guess.</span></div>
      </GlassCard>

      <GlassCard className="gallery-card" eyebrow="MODEL VISUALS" title="Take a closer look">
        <div className="gallery-grid">
          {GALLERY.map((item, index) => (
            <motion.button className="gallery-item" key={item.file} onClick={() => setZoom(item)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.055 }}>
              <span className="gallery-image"><img src={`/results/${item.file}`} alt={item.title} loading="lazy" /><i><Eye size={16} /></i></span>
              <span className="gallery-title">{item.title}</span><small>{item.caption}</small>
            </motion.button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="about-model-card" eyebrow="THE ENGINE" title="About the model">
        <div className="about-model-grid">
          <div className="architecture-visual"><div className="network-mark"><BrainCircuit size={44} /></div><div className="architecture-flow"><span>INPUT<br />28 × 28</span><i /><span>3 × CNN<br />BLOCKS</span><i /><span>DENSE<br />256</span><i /><span>47<br />CLASSES</span></div><p>CharCNN · 594,639 trainable parameters</p></div>
          <div className="about-copy">
            <p>A compact VGG-style convolutional network that learns visual features from handwritten characters. Each block pairs convolution and batch normalization with ReLU, max pooling, and dropout, followed by a 256-unit dense layer.</p>
            <div className="about-facts">
              <div><Database size={16} /><span><b>Training data</b>EMNIST Balanced · 47 classes</span></div>
              <div><Activity size={16} /><span><b>Augmentation</b>Small shifts, rotations &amp; scale variation</span></div>
              <div><Eye size={16} /><span><b>Limitations</b>Similar glyphs, writing style &amp; joined letters affect predictions</span></div>
            </div>
          </div>
        </div>
      </GlassCard>

      <AnimatePresence>
        {zoom && <motion.div className="image-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)} role="presentation">
          <motion.div className="image-modal glass-card" initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={zoom.title}>
            <div><div><p className="eyebrow">MODEL VISUALIZATION</p><h2>{zoom.title}</h2></div><button className="icon-button" onClick={() => setZoom(null)} aria-label="Close image"><X size={19} /></button></div>
            <img src={`/results/${zoom.file}`} alt={zoom.caption} />
            <p>{zoom.caption}</p>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      {!loading && model && <div className="data-source-note">MODEL SNAPSHOT · {model.dataset.toUpperCase()} · CREATED {model.created}</div>}
    </motion.div>
  );
}

function InfoDot() {
  return <span className="plain-info" aria-hidden="true">i</span>;
}
