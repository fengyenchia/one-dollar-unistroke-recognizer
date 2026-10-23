/**
 * The $1 Unistroke Recognizer (JavaScript version)
 *
 *  Jacob O. Wobbrock, Ph.D.
 *  The Information School
 *  University of Washington
 *  Seattle, WA 98195-2840
 *  wobbrock@uw.edu
 *
 *  Andrew D. Wilson, Ph.D.
 *  Microsoft Research
 *  One Microsoft Way
 *  Redmond, WA 98052
 *  awilson@microsoft.com
 *
 *  Yang Li, Ph.D.
 *  Department of Computer Science and Engineering
 *  University of Washington
 *  Seattle, WA 98195-2840
 *  yangli@cs.washington.edu
 *
 * The academic publication for the $1 recognizer, and what should be
 * used to cite it, is:
 *
 *     Wobbrock, J.O., Wilson, A.D. and Li, Y. (2007). Gestures without
 *     libraries, toolkits or training: A $1 recognizer for user interface
 *     prototypes. Proceedings of the ACM Symposium on User Interface
 *     Software and Technology (UIST '07). Newport, Rhode Island (October
 *     7-10, 2007). New York: ACM Press, pp. 159-168.
 *     https://dl.acm.org/citation.cfm?id=1294238
 *
 * The Protractor enhancement was separately published by Yang Li and programmed
 * here by Jacob O. Wobbrock:
 *
 *     Li, Y. (2010). Protractor: A fast and accurate gesture
 *     recognizer. Proceedings of the ACM Conference on Human
 *     Factors in Computing Systems (CHI '10). Atlanta, Georgia
 *     (April 10-15, 2010). New York: ACM Press, pp. 2169-2172.
 *     https://dl.acm.org/citation.cfm?id=1753654
 *
 * This software is distributed under the "New BSD License" agreement:
 *
 * Copyright (C) 2007-2012, Jacob O. Wobbrock, Andrew D. Wilson and Yang Li.
 * All rights reserved. Last updated July 14, 2018.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the names of the University of Washington nor Microsoft,
 *      nor the names of its contributors may be used to endorse or promote
 *      products derived from this software without specific prior written
 *      permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL Jacob O. Wobbrock OR Andrew D. Wilson
 * OR Yang Li BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

/**
 * 專案修改說明：
 * - 使用原始 $1 的黃金分割角度搜尋
 * - N 設定成可調整的 16 / 32 / 64 / 128
 * - 等距重新取樣改用累積路徑長度插值，不修改原始座標陣列
 * - 縮放沿用原版，直接以外接矩形的寬、高分別計算比例
 * - 使用 { x, y } 型別、函式及 JSON 格式讀取，取代原版建構函式 API
 * - recognize() 回傳所有樣板的距離與分數，依距離排序
 */

export type Point = { x: number; y: number };
export type Template = { number: string; points: Point[] };
export const SAMPLE_COUNTS = [16, 32, 64, 128] as const;

const SIZE = 250;
const PHI = (-1 + Math.sqrt(5)) / 2;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(points: Point[]) {
  return points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
}

export function resample(points: Point[], n: number): Point[] {
  if (!SAMPLE_COUNTS.includes(n as (typeof SAMPLE_COUNTS)[number]))
    throw new Error("不支援的 N");
  if (
    points.length < 2 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new Error("請畫出有效軌跡");
  const length = pathLength(points);
  if (length < 1e-6) throw new Error("筆畫太短，請重新繪製");
  // 與原版採用相同的等距插值概念，改以累積路徑長度計算，保留原始座標陣列
  const cumulative = [0];
  for (let i = 1; i < points.length; i++)
    cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  let segment = 1;
  return Array.from({ length: n }, (_, i) => {
    const target = (length * i) / (n - 1);
    while (segment < points.length - 1 && cumulative[segment] < target)
      segment++;
    const span = cumulative[segment] - cumulative[segment - 1];
    const t = span > 0 ? (target - cumulative[segment - 1]) / span : 0;
    const a = points[segment - 1],
      b = points[segment];
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  });
}

// 座標平均中心
function centroid(points: Point[]): Point {
  return points.reduce(
    (c, p) => ({ x: c.x + p.x / points.length, y: c.y + p.y / points.length }),
    { x: 0, y: 0 },
  );
}

function rotateBy(points: Point[], angle: number) {
  const c = centroid(points),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

// 將軌跡縮放到 250 x 250，並將中心移到原點 (0,0)
export function normalize(points: Point[], n: number): Point[] {
  const sampled = resample(points, n),
    c = centroid(sampled);
  const rotated = rotateBy(
    sampled,
    -Math.atan2(c.y - sampled[0].y, c.x - sampled[0].x),
  );
  const xs = rotated.map((p) => p.x),
    ys = rotated.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs),
    height = Math.max(...ys) - Math.min(...ys);

  // 依 250x250 矩形的寬、高分別縮放
  const scaled = rotated.map((p) => ({
    x: (p.x * SIZE) / width,
    y: (p.y * SIZE) / height,
  }));
  const center = centroid(scaled);
  return scaled.map((p) => ({ x: p.x - center.x, y: p.y - center.y }));
}

function pathDistance(a: Point[], b: Point[]) {
  return a.reduce((sum, p, i) => sum + distance(p, b[i]), 0) / a.length;
}

function distanceAtBestAngle(points: Point[], template: Point[]) {
  let a = -Math.PI / 4,
    b = Math.PI / 4;
  let x1 = PHI * a + (1 - PHI) * b,
    x2 = (1 - PHI) * a + PHI * b;
  const at = (angle: number) => pathDistance(rotateBy(points, angle), template);
  let f1 = at(x1),
    f2 = at(x2);
  while (Math.abs(b - a) > Math.PI / 90) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = at(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = at(x2);
    }
  }
  return Math.min(f1, f2);
}

export function recognize(points: Point[], templates: Template[], n: number) {
  if (!templates.length) throw new Error("請先建立或匯入 templates");
  const candidate = normalize(points, n);
  return templates
    .map((t) => {
      const distance = distanceAtBestAngle(candidate, normalize(t.points, n));
      return {
        number: t.number,
        distance,
        score: 1 - distance / (0.5 * Math.hypot(SIZE, SIZE)),
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

export function parseTemplates(value: unknown): Template[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("templates" in value) ||
    !Array.isArray(value.templates)
  )
    throw new Error("JSON 格式不正確");
  const templates = value.templates;
  return templates.map((t) => {
    const number = t?.number;
    if (
      !t ||
      typeof t !== "object" ||
      typeof number !== "string" ||
      !Array.isArray(t.points)
    )
      throw new Error(
        "JSON 格式不正確：每個 template 需包含 number 與 points 陣列",
      );
    const points: Point[] = t.points.map((p: Point) => {
      if (
        !p ||
        typeof p.x !== "number" ||
        typeof p.y !== "number" ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y)
      )
        throw new Error("座標資料不正確");
      return { x: p.x, y: p.y };
    });
    return { number, points };
  });
}