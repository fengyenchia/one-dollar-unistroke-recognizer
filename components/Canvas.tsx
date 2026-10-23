"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Point } from "@/lib/OneDollarRecognizer";
// Crops of the actual supplied reference sheet, including direction arrows.
const CROPS = [
  [180, 18, 72, 92],
  [286, 18, 26, 92],
  [348, 18, 68, 92],
  [443, 18, 63, 92],
  [525, 18, 67, 72],
  [614, 15, 71, 96],
  [1, 132, 66, 96],
  [81, 132, 55, 96],
  [159, 132, 62, 96],
  [229, 132, 67, 96],
];
export default function DrawingCanvas({
  points,
  onChange,
  digit,
  showGuide,
  opacity,
}: {
  points: Point[];
  onChange: (points: Point[]) => void;
  digit: string;
  showGuide: boolean;
  opacity: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    stroke = useRef<Point[]>([]),
    active = useRef<number | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = "/graffiti-reference.png";
    return () => {
      img.onload = null;
    };
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 500, 500);
    if (showGuide && image) {
      const [x, y, w, h] = CROPS[Number(digit)],
        scale = 290 / Math.max(w, h);
      ctx.globalAlpha = opacity;
      ctx.drawImage(
        image,
        x,
        y,
        w,
        h,
        (500 - w * scale) / 2,
        (500 - h * scale) / 2,
        w * scale,
        h * scale,
      );
      ctx.globalAlpha = 1;
    }
    if (!points.length) return;
    ctx.strokeStyle = getComputedStyle(canvas.current!)
      .getPropertyValue("--primary")
      .trim();
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 6, 0, Math.PI * 2);
    ctx.fill();
  }, [points, image, digit, showGuide, opacity]);
  function point(e: PointerEvent<HTMLCanvasElement>): Point {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(500, ((e.clientX - r.left) * 500) / r.width)),
      y: Math.max(0, Math.min(500, ((e.clientY - r.top) * 500) / r.height)),
    };
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (!e.isPrimary || e.button !== 0 || active.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = e.pointerId;
    stroke.current = [point(e)];
    onChange([...stroke.current]);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (active.current !== e.pointerId || stroke.current.length >= 20000)
      return;
    const next = point(e),
      last = stroke.current[stroke.current.length - 1];
    if (next.x !== last.x || next.y !== last.y) {
      stroke.current.push(next);
      onChange([...stroke.current]);
    }
  }
  return (
    <canvas
      ref={canvas}
      width={500}
      height={500}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={(e) => {
        if (active.current === e.pointerId) {
          move(e);
          active.current = null;
        }
      }}
      onPointerCancel={() => {
        active.current = null;
        stroke.current = [];
        onChange([]);
      }}
      onLostPointerCapture={() => {
        active.current = null;
      }}
      className="aspect-square w-full touch-none cursor-crosshair rounded-xs bg-surface"
    />
  );
}