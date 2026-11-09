import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Clipboard, Eraser, Info, RotateCcw, Sparkles } from "lucide-react";
import { predict } from "../api/client";
import { ConfidenceRing } from "../components/ConfidenceRing";
import DrawingCanvas, { type DrawingCanvasHandle } from "../components/DrawingCanvas";
import { GlassCard } from "../components/GlassCard";
import { PredictionBars } from "../components/PredictionBars";
import { CharacterTypeControl } from "../components/CharacterTypeControl";
import type { AllowedType, HistoryEntry, PredictionResponse } from "../types";
import { saveRecognition } from "../lib/history";
import type { Notify } from "../App";
import { useCharacterType } from "../hooks/useCharacterType";

const EXAMPLES = ["A", "g", "7", "R", "q", "3", "b", "F", "2", "Z", "n", "0"];

export default function Recognize({ notify, apiOnline }: { notify: Notify; apiOnline: boolean }) {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const requestId = useRef(0);
  const [brushSize, setBrushSize] = useState(19);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { allowed, setAllowed, showLowercase, setShowLowercase } = useCharacterType("all");

  const submit = useCallback(async (
    image: string,
    finished: boolean,
    hasInk: boolean,
    selectedAllowed: AllowedType = allowed,
  ) => {
    window.clearTimeout(timerRef.current);
    if (!hasInk) {
      requestId.current += 1;
      setLoading(false);
      setResult(null);
      return;
    }
    if (!apiOnline) {
      requestId.current += 1;
      setLoading(false);
      return;
    }
    const send = async () => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      try {
        const response = await predict(image, 3, selectedAllowed);
        if (currentRequest !== requestId.current) return;
        setResult(response);
        if (finished && response.predictions[0]) {
          const entry: HistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            char: displayCharacter(response.predictions[0].char, selectedAllowed, showLowercase),
            confidence: response.predictions[0].probability,
            thumbnail: image,
          };
          saveRecognition(entry);
        }
      } catch (error) {
        if (currentRequest === requestId.current) {
          notify(error instanceof Error ? error.message : "Could not recognize this drawing.", "error");
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    };
    if (finished) void send();
    else timerRef.current = window.setTimeout(() => void send(), 300);
  }, [allowed, apiOnline, notify, showLowercase]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
      if (event.key.toLowerCase() === "c" && !event.ctrlKey && !event.metaKey) {
        canvasRef.current?.clear();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        canvasRef.current?.undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const tryExample = () => {
    const letter = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    canvasRef.current?.drawExample(letter);
  };

  const copyResult = async () => {
    if (!result?.predictions[0]) return;
    try {
      await navigator.clipboard.writeText(displayCharacter(result.predictions[0].char, allowed, showLowercase));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      notify("Clipboard access is unavailable in this browser.", "error");
    }
  };

  const primary = result?.predictions[0]
    ? { ...result.predictions[0], char: displayCharacter(result.predictions[0].char, allowed, showLowercase) }
    : undefined;
  const visiblePredictions = result?.predictions.map((prediction) => ({
    ...prediction,
    char: displayCharacter(prediction.char, allowed, showLowercase),
  }));
  const changeAllowed = (next: AllowedType) => {
    setAllowed(next);
    if (result && apiOnline) {
      submit(canvasRef.current?.exportImage() ?? "", true, true, next);
    }
  };

  return (
    <motion.div className="page-content recognize-page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <div className="page-intro">
        <div>
          <div className="section-kicker"><span className="kicker-line" /> INTERACTIVE LAB <span className="kicker-dot">01</span></div>
          <h1>Make a mark.<br /><span>See what it means.</span></h1>
          <p>Draw any digit or letter and let the model take its best guess.</p>
        </div>
        <div className="model-status"><span className="status-pulse" /> EMNIST BALANCED <span className="status-divider">/</span> 47 CLASSES</div>
      </div>

      <GlassCard className="filter-card">
        <CharacterTypeControl
          allowed={allowed}
          onChange={changeAllowed}
          showLowercase={showLowercase}
          onShowLowercaseChange={setShowLowercase}
        />
      </GlassCard>

      <div className="recognize-grid">
        <GlassCard className="draw-card" eyebrow="YOUR INPUT" title="Drawing board" action={<span className="canvas-size-tag">480 × 480</span>}>
          <DrawingCanvas ref={canvasRef} brushSize={brushSize} onChange={submit} />
          <div className="canvas-controls">
            <label className="brush-control">
              <span>Brush <strong>{brushSize}px</strong></span>
              <input aria-label="Brush size" type="range" min="7" max="33" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
            <div className="button-cluster">
              <button className="button button-quiet" onClick={() => canvasRef.current?.undo()} aria-label="Undo last stroke" title="Undo (Ctrl+Z)"><RotateCcw size={15} /> <span>Undo</span></button>
              <button className="button button-quiet" onClick={() => canvasRef.current?.clear()} aria-label="Clear drawing" title="Clear (C)"><Eraser size={15} /> <span>Clear</span></button>
            </div>
          </div>
          <div className="draw-card-footer">
            <span>Pointer or touch enabled <i /></span>
            <span><kbd>C</kbd> clear <b>·</b> <kbd>Ctrl Z</kbd> undo</span>
          </div>
        </GlassCard>

        <div className="result-column">
          <GlassCard className="result-card" eyebrow="MODEL'S BEST GUESS" title="Recognition">
            <div className="recognition-result">
              <div className="character-stage">
                <AnimatePresence mode="wait">
                  {primary ? (
                    <motion.div
                      key={primary.char}
                      className="hero-character"
                      initial={{ scale: 0.45, opacity: 0, rotate: -10 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 17 }}
                    >{primary.char}</motion.div>
                  ) : <div className="character-placeholder">{loading ? <span className="pulse-dots">···</span> : "?"}</div>}
                </AnimatePresence>
                <div className="character-label">{primary ? "PREDICTED CHARACTER" : loading ? "ANALYZING STROKES" : "WAITING FOR INPUT"}</div>
              </div>
              <div className="confidence-block">
                {loading && !primary ? <div className="skeleton-ring" /> : <ConfidenceRing value={primary?.probability ?? 0} />}
                <div><strong>Confidence</strong><small>{primary ? `${(primary.probability * 100).toFixed(1)}% match` : "Top prediction"}</small></div>
              </div>
            </div>
            {primary && !result?.confident && (
              <motion.div className="confidence-warning" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <AlertTriangle size={15} /> Not sure, try drawing more clearly
              </motion.div>
            )}
            {result?.suspicious && <div className="suspicious-chip"><AlertTriangle size={13} /> This looks more like a {allowed === "digits" ? "letter" : "digit"}, try another mode</div>}
            {loading && <div className="recognition-progress"><span /></div>}
            <div className="result-divider" />
            <div className="subsection-title"><span>ALTERNATIVES</span><span>PROBABILITY</span></div>
            {visiblePredictions ? <PredictionBars predictions={visiblePredictions} /> : (
              <div className={`prediction-empty ${loading ? "skeleton-bars" : ""}`}>
                {[0, 1, 2].map((item) => <div key={item}><i /><span /></div>)}
              </div>
            )}
            <div className="result-actions">
              <button className="button button-primary" onClick={tryExample}><Sparkles size={16} /> Try an example</button>
              <button className="button button-outline" disabled={!primary} onClick={() => void copyResult()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Copied" : "Copy result"}</button>
            </div>
          </GlassCard>

          <GlassCard className="model-view-card" eyebrow="PREPROCESSING PREVIEW" title="What the model sees">
            <div className="model-view-content">
              <div className="processed-preview">
                {result ? <img src={`data:image/png;base64,${result.processed_image}`} alt="Processed 28 by 28 character, enlarged with nearest-neighbor pixels" /> : <div className="processed-empty"><span>28</span><small>× 28</small></div>}
              </div>
              <div className="processed-copy">
                <div className="pipeline-label"><span>01</span> CENTERED &amp; NORMALIZED</div>
                <p>The character is cropped, centered, and resized before it reaches the neural network.</p>
                <span className="pixel-note"><i /> PIXEL PREVIEW · 224 PX</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="info-note">
        <div className="info-icon"><Info size={17} /></div>
        <p><strong>A note on letter cases.</strong> EMNIST merges uppercase and lowercase versions of look-alike letters (such as C/c, O/o, S/s, W/w, X/x, Z/z, and K/k), so those are shown in uppercase. Common look-alikes can also be tricky: <b>O/0 · I/1 · S/5 · Z/2 · q/9 · g/9 · F/f</b>.</p>
        <span>≈90% TEST ACCURACY</span>
      </div>
    </motion.div>
  );
}

function displayCharacter(character: string, allowed: AllowedType, showLowercase: boolean): string {
  return allowed === "letters" && showLowercase ? character.toLowerCase() : character;
}
