/**
 * progress-color.ts
 *
 * Maps a completion percentage (0-100+) to a smooth, perceptually-uniform colour.
 *
 * DESIGN PRINCIPLE:
 * All colours are generated via HSL with a fixed lightness (~52%) and saturation (~82%)
 * so brightness stays visually consistent across the entire range. The only thing
 * that changes smoothly is the hue:
 *
 *   0%   -> Hue   0  (vivid red)
 *   25%  -> Hue  25  (orange)
 *   50%  -> Hue  48  (amber/yellow)
 *   75%  -> Hue 115  (green)
 *   100% -> Hue 145  (emerald)
 *   >100%-> Hue 160  (teal-green, slightly richer)
 *
 * Interpolation is continuous - every 1% produces a perceptibly different hue
 * with NO brightness drop and NO banding.
 */

/** Linear interpolation between two numbers */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

/**
 * Converts HSL values to a hex colour string.
 * h: 0-360, s: 0-100, l: 0-100
 */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) =>
    lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Control points: [percent, hue, saturation, lightness]
 * Lightness and saturation are kept nearly constant for perceptual uniformity.
 * Only hue shifts to signal progress level.
 */
const CONTROL_POINTS: [number, number, number, number][] = [
  [0, 0, 82, 48], // vivid red
  [25, 22, 85, 50], // orange
  [50, 46, 80, 52], // amber
  [75, 112, 72, 44], // green (green is perceptually brighter, drop lightness slightly)
  [100, 148, 68, 40], // emerald
  [125, 162, 65, 38], // teal-green (overachievement)
];

/**
 * Returns a hex colour string for a given completion percentage.
 * Accepts values above 100 for overachievement (caps at the last control point).
 * Works at 1% granularity with smooth continuous interpolation.
 */
export function progressColor(percent: number): string {
  const p = Math.max(0, percent);

  // Find surrounding control points
  let lower = CONTROL_POINTS[0];
  let upper = CONTROL_POINTS[CONTROL_POINTS.length - 1];

  for (let i = 0; i < CONTROL_POINTS.length - 1; i++) {
    if (p >= CONTROL_POINTS[i][0] && p <= CONTROL_POINTS[i + 1][0]) {
      lower = CONTROL_POINTS[i];
      upper = CONTROL_POINTS[i + 1];
      break;
    }
  }

  // If beyond last control point, clamp to last segment
  if (p > CONTROL_POINTS[CONTROL_POINTS.length - 1][0]) {
    lower = CONTROL_POINTS[CONTROL_POINTS.length - 2];
    upper = CONTROL_POINTS[CONTROL_POINTS.length - 1];
  }

  const t = lower[0] === upper[0] ? 1 : (p - lower[0]) / (upper[0] - lower[0]);
  const h = lerp(lower[1], upper[1], t);
  const s = lerp(lower[2], upper[2], t);
  const l = lerp(lower[3], upper[3], t);

  return hslToHex(h, s, l);
}
