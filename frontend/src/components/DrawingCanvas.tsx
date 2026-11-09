import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WordCharacter } from "../types";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  size: number;
  image?: ImageData;
}

export interface DrawingCanvasHandle {
  clear: () => void;
  undo: () => void;
  exportImage: () => string;
  drawExample: (character: string) => void;
}

interface DrawingCanvasProps {
  brushSize: number;
  onChange: (image: string, finished: boolean, hasInk: boolean) => void;
  wide?: boolean;
  boxes?: WordCharacter[];
}

const SIZE = 480;

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas({ brushSize, onChange, wide = false, boxes = [] }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const currentRef = useRef<Stroke | null>(null);
    const [hasDrawing, setHasDrawing] = useState(false);

    const exportImage = useCallback(() => {
      const source = canvasRef.current;
      if (!source) return "";
      const output = document.createElement("canvas");
      output.width = source.width;
      output.height = source.height;
      const context = output.getContext("2d");
      if (!context) return "";
      context.fillStyle = "#050811";
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(source, 0, 0);
      return output.toDataURL("image/png");
    }, []);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineCap = "round";
      context.lineJoin = "round";
      [...strokesRef.current, ...(currentRef.current ? [currentRef.current] : [])].forEach((stroke) => {
        if (stroke.image) {
          context.putImageData(stroke.image, 0, 0);
          return;
        }
        if (stroke.points.length === 0) return;
        context.beginPath();
        context.strokeStyle = "#fff";
        context.lineWidth = stroke.size;
        context.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        if (stroke.points.length === 1) {
          context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
        }
        context.stroke();
      });
    }, []);

    const reportChange = useCallback((finished: boolean) => {
      const ink = strokesRef.current.length > 0 || currentRef.current !== null;
      setHasDrawing(ink);
      onChange(exportImage(), finished, ink);
    }, [exportImage, onChange]);

    const clear = useCallback(() => {
      strokesRef.current = [];
      currentRef.current = null;
      render();
      reportChange(true);
    }, [render, reportChange]);

    const undo = useCallback(() => {
      if (currentRef.current) currentRef.current = null;
      else strokesRef.current.pop();
      render();
      reportChange(true);
    }, [render, reportChange]);

    const drawExample = useCallback((character: string) => {
      currentRef.current = null;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      context.clearRect(0, 0, SIZE, SIZE);
      context.fillStyle = "#fff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "300px Georgia, serif";
      context.fillText(character, SIZE / 2, SIZE / 2 + 5);
      strokesRef.current = [{ points: [], size: 12, image: context.getImageData(0, 0, SIZE, SIZE) }];
      render();
      reportChange(true);
    }, [render, reportChange]);

    useImperativeHandle(ref, () => ({ clear, undo, exportImage, drawExample }), [
      clear, undo, exportImage, drawExample,
    ]);

    const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
        y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
      };
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      currentRef.current = { points: [pointFromEvent(event)], size: brushSize };
      render();
      reportChange(false);
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!currentRef.current) return;
      event.preventDefault();
      currentRef.current.points.push(pointFromEvent(event));
      render();
      reportChange(false);
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!currentRef.current) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      strokesRef.current.push(currentRef.current);
      currentRef.current = null;
      render();
      reportChange(true);
    };

    return (
      <div className={`drawing-surface ${wide ? "drawing-wide" : ""}`}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          aria-label={wide ? "Write separated characters in this drawing area" : "Draw a handwritten character"}
          role="img"
          className="drawing-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {boxes.map((character, index) => (
          <span
            className={`segmentation-box ${character.touching || character.probability < 0.6 ? "segmentation-box-warning" : ""}`}
            key={`${character.box[0]}-${character.box[1]}-${index}`}
            style={{
              left: `${(character.box[0] / SIZE) * 100}%`,
              top: `${(character.box[1] / SIZE) * 100}%`,
              width: `${((character.box[2] - character.box[0]) / SIZE) * 100}%`,
              height: `${((character.box[3] - character.box[1]) / SIZE) * 100}%`,
            }}
            aria-hidden="true"
          />
        ))}
        {!hasDrawing && (
          <div className="canvas-placeholder" aria-hidden="true">
            <span className="placeholder-cross">＋</span>
            <span>{wide ? "Write a short word" : "Draw a character here"}</span>
            <small>{wide ? "Leave a clear gap between each letter" : "Your strokes stay on this device"}</small>
          </div>
        )}
        <span className="canvas-coordinate" aria-hidden="true">CANVAS / 28 × 28 MODEL INPUT</span>
      </div>
    );
  },
);

export default DrawingCanvas;
