"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import DrawingCanvas from "@/components/Canvas";
import {
  parseTemplates,
  recognize,
  SAMPLE_COUNTS,
  type Point,
  type Template,
} from "@/lib/OneDollarRecognizer";

const STORAGE = "graffiti-templates-v1";
const button =
  "rounded-xs border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton = `${button} border-primary! bg-primary! text-primary-foreground hover:bg-primary/90!`;
const digits = Array.from({ length: 10 }, (_, i) => String(i));

function Preview({ points }: { points: Point[] }) {
  return (
    <svg
      viewBox="0 0 500 500"
      className="aspect-square w-full rounded-xs bg-muted"
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="5"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 0 ? 10 : 4}
          fill="var(--primary)"
        />
      ))}
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"templates" | "recognize">("templates");
  const [digit, setDigit] = useState("0");
  const [n, setN] = useState(64);
  const [points, setPoints] = useState<Point[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<{
    n: number;
    rankings: ReturnType<typeof recognize>;
  } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(STORAGE);
        if (saved) setTemplates(parseTemplates(JSON.parse(saved)));
      } catch {
        console.error("無法讀取本機資料，請匯入備份 JSON");
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(next: Template[]) {
    setTemplates(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ templates: next }));
    } catch {
      console.error("本機儲存失敗，資料暫存於本頁，請匯出 JSON 備份");
    }
  }
  function updatePoints(next: Point[]) {
    setPoints(next);
    setResult(null);
  }
  function reset() {
    updatePoints([]);
  }
  function selectTab(next: typeof tab) {
    setTab(next);
    reset();
  }
  function save() {
    persist(
      [
        ...templates.filter((t) => t.number !== digit),
        { number: digit, points: points.map((p) => ({ ...p })) },
      ].sort((a, b) => a.number.localeCompare(b.number)),
    );
  }
  function exportJson() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ templates }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "graffiti-templates.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importJson(file?: File) {
    if (!file) return;
    try {
      const next = parseTemplates(JSON.parse(await file.text()));
      if (templates.length && !window.confirm("匯入會取代目前全部 templates"))
        return;
      reset();
      persist(next);
    } catch (error) {
      console.error(`匯入失敗：${(error as Error).message}`);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  function run() {
    try {
      setResult({ n, rankings: recognize(points, templates, n) });
    } catch (error) {
      console.error((error as Error).message);
    }
  }

  const selected = templates.find((t) => t.number === digit);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 font-sans text-foreground sm:px-8 flex flex-col gap-8">
      <header className="flex justify-center">
        <h1 className="text-xl md:text-2xl font-semibold">
          HW#3: $1 Unistroke Recognizer
        </h1>
      </header>

      <nav className="flex gap-4 rounded-xs bg-muted">
        {(
          [
            ["templates", "建立 templates"],
            ["recognize", "$1 Unistroke Recognizer"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => selectTab(value)}
            className={`flex-1 rounded-xs border p-2 text-sm font-medium ${tab === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xs border border-border bg-surface p-4 sm:p-6">
          {tab === "recognize" && (
            <div className="mb-5 flex justify-between items-center">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                取樣點數 N
                <select
                  value={n}
                  onChange={(e) => {
                    setN(Number(e.target.value));
                    setResult(null);
                  }}
                  className="rounded-xs border border-border bg-surface px-3 py-2 text-foreground"
                >
                  {SAMPLE_COUNTS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                原始座標{" "}
                <strong className="font-mono text-foreground">
                  {points.length}
                </strong>{" "}
                點 <span className="mx-1 text-muted-foreground">/</span>{" "}
                重新取樣{" "}
                <strong className="font-mono text-foreground">{n}</strong> 點
              </p>
            </div>
          )}
          {tab === "templates" && (
            <div className="mb-4 grid grid-cols-10 gap-1.5">
              {digits.map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setDigit(value);
                    reset();
                  }}
                  className={`relative rounded-xs border py-2 font-medium ${digit === value ? "border-primary text-primary" : "border-border"}`}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
          <div className="mx-auto max-w-100 overflow-hidden rounded-xs border border-border">
            <DrawingCanvas
              key={`${tab}-${digit}`}
              points={points}
              onChange={updatePoints}
              digit={digit}
              showGuide={tab === "templates"}
              opacity={0.3}
            />
          </div>
          <div className="flex gap-2 justify-end w-full mt-4">
            <button onClick={reset} className={button}>
              清除筆畫
            </button>
            {tab === "templates" ? (
              <button
                disabled={!loaded || points.length < 2}
                onClick={save}
                className={primaryButton}
              >
                {selected ? "取代" : "儲存"} template {digit}
              </button>
            ) : (
              <button
                disabled={!loaded || !templates.length || points.length < 2}
                onClick={run}
                className={primaryButton}
              >
                辨識筆畫
              </button>
            )}
          </div>
        </section>
        <aside className="space-y-5">
          {tab === "recognize" ? (
            <section className="rounded-xs border border-border bg-surface p-5">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold">辨識結果</h2>
                {result && <p className="text-md text-primary">N = {result.n}</p>}
              </div>
              {result ? (
                <>
                  <div className="my-6 flex items-end justify-between">
                    <span className="text-6xl font-semibold text-primary">
                      {result.rankings[0].number}
                    </span>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        相似度分數
                      </p>
                      <p className="font-mono text-2xl">
                        {result.rankings[0].score.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <ol className="space-y-2">
                    {result.rankings.map((r) => (
                      <li
                        key={r.number}
                        className="flex justify-between rounded-xs bg-muted px-3 py-2 text-sm"
                      >
                        <span>{r.number}</span>
                        <span className="font-mono">{r.score.toFixed(4)}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  顯示辨識結果與各相似度分數
                </p>
              )}
              {templates.length < 10 && (
                <p className="mt-4 text-xs text-primary">
                  缺{" "}
                  {digits
                    .filter((d) => !templates.some((t) => t.number === d))
                    .join("、")}{" "}
                  的 template
                </p>
              )}
            </section>
          ) : (
            <section className="rounded-xs border border-border bg-surface p-5">
              <div className="mb-3 flex justify-between items-center">
                <h2 className="font-semibold">{digit}</h2>
                <span className="text-xs text-muted-foreground">
                  {selected ? `${selected.points.length} 個原始點` : "尚未建立"}
                </span>
              </div>
              {selected ? (
                <Preview points={selected.points} />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xs border border-dashed border-border text-sm text-muted-foreground">
                  儲存軌跡後預覽
                </div>
              )}
            </section>
          )}
          {tab === "templates" && (
            <section className="rounded-xs border border-border bg-surface p-5">
              <h2 className="font-semibold">原始座標點 templates</h2>
              <p className="my-3 text-sm leading-6 text-muted-foreground">
                自動儲存在 local storage，可匯出／匯入 JSON 備份原始座標
              </p>
              <div className="flex justify-end gap-2">
                <button
                  disabled={!loaded || !templates.length}
                  onClick={exportJson}
                  className={button}
                >
                  匯出 JSON
                </button>
                <button
                  disabled={!loaded}
                  onClick={() => importRef.current?.click()}
                  className={button}
                >
                  匯入 JSON
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void importJson(e.target.files?.[0])}
                  className="hidden"
                />
              </div>
            </section>
          )}
        </aside>
      </div>

      <div className="flex flex-col">
        <h2 className="mb-3 font-semibold text-xl">
          Palm Pilot Graffiti patterns
        </h2>
        <div className="rounded-xs border border-border bg-surface p-5">
          <Image
            src="/graffiti-reference.png"
            alt="Palm Pilot Graffiti patterns"
            width={708}
            height={267}
            className="h-auto w-full rounded-xs"
          />
        </div>
      </div>
    </main>
  );
}