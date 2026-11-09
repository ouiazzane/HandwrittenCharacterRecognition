import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Eraser, RotateCcw, ScanText, Sparkles } from "lucide-react";
import { predictWord } from "../api/client";
import { CharacterTypeControl } from "../components/CharacterTypeControl";
import DrawingCanvas, { type DrawingCanvasHandle } from "../components/DrawingCanvas";
import { GlassCard } from "../components/GlassCard";
import { useCharacterType } from "../hooks/useCharacterType";
import type { AllowedType, WordResponse } from "../types";
import type { Notify } from "../App";

export default function WordMode({ notify, apiOnline }: { notify: Notify; apiOnline: boolean }) {
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeRequest = useRef(0);
  const [result, setResult] = useState<WordResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [finalWord, setFinalWord] = useState("");
  const { allowed, setAllowed, showLowercase, setShowLowercase } = useCharacterType("letters");

  const send = useCallback(async (image: string, selectedAllowed: AllowedType = allowed) => {
    if (!apiOnline) return;
    const requestId = ++activeRequest.current;
    setLoading(true);
    try {
      const response = await predictWord(image, selectedAllowed);
      if (requestId === activeRequest.current) {
        setResult(response);
        setFinalWord(formatWord(response.text, selectedAllowed, showLowercase));
      }
    } catch (error) {
      if (requestId === activeRequest.current) notify(error instanceof Error ? error.message : "Could not segment this word.", "error");
    } finally {
      if (requestId === activeRequest.current) setLoading(false);
    }
  }, [allowed, apiOnline, notify, showLowercase]);

  const submit = useCallback((image: string, finished: boolean, ink: boolean) => {
    setHasInk(ink);
    window.clearTimeout(timer.current);
    if (!ink) {
      activeRequest.current += 1;
      setResult(null);
      setFinalWord("");
      setLoading(false);
      return;
    }
    if (!apiOnline) return;
    if (!finished) {
      timer.current = window.setTimeout(() => void send(image), 500);
    } else {
      void send(image);
    }
  }, [apiOnline, send]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const changeAllowed = (next: AllowedType) => {
    window.clearTimeout(timer.current);
    setAllowed(next);
    if (hasInk && apiOnline) {
      void send(canvasRef.current?.exportImage() ?? "", next);
    }
  };

  const chooseAlternative = (index: number, character: string) => {
    const displayed = formatCharacter(character, allowed, showLowercase);
    setResult((current) => {
      if (!current) return current;
      const characters = current.characters.map((item, itemIndex) => (
        itemIndex === index ? { ...item, char: character } : item
      ));
      return { ...current, characters, text: characters.map((item) => item.char).join("") };
    });
    setFinalWord((current) => {
      const chars = Array.from(current);
      chars[index] = displayed;
      return chars.join("");
    });
  };

  const clear = () => canvasRef.current?.clear();

  return (
    <motion.div className="page-content word-page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <div className="page-intro">
        <div>
          <div className="section-kicker"><span className="kicker-line" /> EXPERIMENTAL LAB <span className="kicker-dot">02</span></div>
          <h1>Write a <span>whole word.</span></h1>
          <p>Explore character segmentation before recognition.</p>
        </div>
        <div className="model-status"><span className="status-pulse" /> CONNECTED COMPONENTS <span className="status-divider">/</span> BETA</div>
      </div>

      <GlassCard className="filter-card">
        <CharacterTypeControl
          allowed={allowed}
          onChange={changeAllowed}
          showLowercase={showLowercase}
          onShowLowercaseChange={setShowLowercase}
        />
      </GlassCard>

      <div className="word-layout">
        <GlassCard className="word-drawing-card" eyebrow="WORD INPUT" title="Write left to right" action={<span className="canvas-size-tag">480 × 290</span>}>
          <DrawingCanvas ref={canvasRef} brushSize={17} onChange={submit} wide boxes={result?.characters} />
          <div className="word-tools">
            <span className="draw-card-footer" style={{ margin: 0 }}>Keep each character separated</span>
            <div className="button-cluster">
              <button className="button button-quiet" onClick={() => canvasRef.current?.undo()} aria-label="Undo last stroke"><RotateCcw size={15} /> Undo</button>
              <button className="button button-quiet" onClick={clear} aria-label="Clear word"><Eraser size={15} /> Clear</button>
            </div>
          </div>
          <div className="word-notice"><AlertTriangle size={16} /><span><strong>Experimental: character segmentation may fail on connected writing.</strong> Each glyph should be separate; merged strokes are only split when the projection profile has a clear valley.</span></div>
          {result?.characters.some((character) => character.touching) && (
            <div className="joined-letter-banner">
              Joined letters cannot be separated reliably. For connected handwriting use the Read text page (TrOCR)
            </div>
          )}
          {result?.suspicious && <div className="suspicious-chip"><AlertTriangle size={13} /> This looks more like a {allowed === "digits" ? "letter" : "digit"}, try another mode</div>}
          <label className="final-word-label" htmlFor="final-word">FINAL WORD</label>
          <input
            id="final-word"
            className="final-word-input"
            value={allowed === "letters" && showLowercase ? finalWord.toLowerCase() : finalWord}
            onChange={(event) => setFinalWord(event.target.value)}
            placeholder={loading ? "Recognizing…" : "Edit the recognized word"}
            aria-label="Editable recognized word"
          />
          {result && (
            <div className="word-character-list">
              {result.characters.map((item, index) => (
                <div className={`word-character-chip ${item.touching || item.probability < 0.6 ? "word-chip-warning" : ""}`} key={`${index}-${item.box[0]}`}>
                  <strong>{formatCharacter(item.char, allowed, showLowercase)}</strong>
                  <small>{(item.probability * 100).toFixed(0)}% confidence</small>
                  {item.suspicious && <small className="chip-suspicious">Low type match</small>}
                  <details className="alternative-popover">
                    <summary>Top alternatives</summary>
                    <div className="alternative-list">
                      {item.predictions.map((alternative) => (
                        <button
                          key={alternative.char}
                          type="button"
                          onClick={(event) => {
                            chooseAlternative(index, alternative.char);
                            const details = event.currentTarget.closest("details");
                            if (details) details.open = false;
                          }}
                        >
                          <span>{formatCharacter(alternative.char, allowed, showLowercase)}</span>
                          <small>{(alternative.probability * 100).toFixed(0)}%</small>
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="word-result-card" eyebrow="SEGMENTATION MAP" title="Character by character">
          <p className="section-description">Green boxes indicate separate components; red boxes are uncertain or touching.</p>
          {result ? (
            <>
              <div className="segmentation-preview"><img src={canvasRef.current?.exportImage()} alt="Original word drawing with connected-component boxes overlaid on the canvas" /></div>
              <div className="word-character-list" style={{ marginTop: 13 }}>{result.characters.map((item, index) => (
                <div className={`word-character-chip ${item.touching || item.probability < 0.6 ? "word-chip-warning" : ""}`} key={`${item.box[0]}-${index}`}>
                  <strong>{formatCharacter(item.char, allowed, showLowercase)}</strong>
                  <small>{item.box[0]}, {item.box[1]}–{item.box[2]}, {item.box[3]}</small>
                </div>
              ))}</div>
            </>
          ) : (
            <div className="word-empty-state"><ScanText size={28} /><p>{loading ? "Finding character boundaries…" : "Your segmented characters will appear here."}</p></div>
          )}
          <button className="button button-primary" onClick={() => {
            const sample = canvasRef.current;
            if (!sample) return;
            sample.drawExample("A");
            notify("For best results, write multiple separated characters in the canvas.", "info");
          }}><Sparkles size={15} /> Try an example stroke</button>
        </GlassCard>
      </div>
    </motion.div>
  );
}

function formatCharacter(character: string, allowed: AllowedType, showLowercase: boolean): string {
  return allowed === "letters" && showLowercase ? character.toLowerCase() : character;
}

function formatWord(word: string, allowed: AllowedType, showLowercase: boolean): string {
  return allowed === "letters" && showLowercase ? word.toLowerCase() : word;
}
