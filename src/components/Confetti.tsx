import { useEffect, useMemo, useState } from "react";

const COLORS = ["#7c3aed", "#a78bfa", "#38bdf8", "#f59e0b", "#22c55e", "#facc15", "#f43f5e"];
const PIECE_COUNT = 46;
const BURST_DURATION_MS = 2800;

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  drift: number;
  rotate: number;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.25,
    duration: 1.6 + Math.random() * 1.1,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 6,
    drift: (Math.random() - 0.5) * 140,
    rotate: 360 + Math.random() * 720,
  }));
}

/**
 * Small self-contained confetti burst, no external library. Bump `trigger`
 * (any counter/id) to fire a fresh burst - works even for repeated bursts
 * back to back, unlike a plain boolean which can't signal "again" while
 * already true.
 */
export default function Confetti({ trigger }: { trigger: number }) {
  const [show, setShow] = useState(false);
  const pieces = useMemo<Piece[]>(() => (trigger > 0 ? makePieces() : []), [trigger]);

  useEffect(() => {
    if (trigger <= 0) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), BURST_DURATION_MS);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 z-[1300] overflow-hidden pointer-events-none">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            borderRadius: 1,
            animation: `mifga-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            // @ts-expect-error custom props read by the keyframe below
            "--drift": `${p.drift}px`,
            "--rotate": `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
