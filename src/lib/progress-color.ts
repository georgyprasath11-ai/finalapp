/**
 * progress-color.ts
 *
 * Maps a completion percentage (0-100+) to a smooth hex colour.
 * Each range has 25 shades so every 1% increment produces a distinct colour.
 *
 * Ranges:
 *   0-25   -> RED spectrum
 *   25-50  -> ORANGE spectrum
 *   50-75  -> YELLOW spectrum
 *   75-100 -> GREEN spectrum
 *   > 100  -> DARK GREEN spectrum
 */

const RED_SHADES: string[] = [
  "#FF0000","#F50000","#EB0000","#E10000","#D70000",
  "#CD0000","#C30000","#B90000","#AF0000","#A50000",
  "#9B0000","#910000","#870000","#7D0000","#730000",
  "#690000","#5F0000","#550000","#4B0000","#410000",
  "#370000","#2D0000","#230000","#190000","#0F0000",
];

const ORANGE_SHADES: string[] = [
  "#FF4500","#F24100","#E53D00","#D83900","#CB3500",
  "#BE3100","#B12D00","#A42900","#972500","#8A2100",
  "#7D1D00","#701900","#631500","#561100","#490D00",
  "#3C0900","#2F0500","#220100","#FF5A1F","#FF6F3F",
  "#FF844F","#FF995F","#FFAE6F","#FFC37F","#FFD88F",
];

const YELLOW_SHADES: string[] = [
  "#FFFF00","#F5F500","#EBEB00","#E1E100","#D7D700",
  "#CDCD00","#C3C300","#B9B900","#AFAF00","#A5A500",
  "#9B9B00","#919100","#878700","#7D7D00","#737300",
  "#696900","#5F5F00","#555500","#4B4B00","#414100",
  "#373700","#2D2D00","#232300","#191900","#0F0F00",
];

const GREEN_SHADES: string[] = [
  "#00FF00","#00F500","#00EB00","#00E100","#00D700",
  "#00CD00","#00C300","#00B900","#00AF00","#00A500",
  "#009B00","#009100","#008700","#007D00","#007300",
  "#006900","#005F00","#005500","#004B00","#004100",
  "#003700","#002D00","#002300","#001900","#000F00",
];

const DARK_GREEN_SHADES: string[] = [
  "#004d00","#004700","#004100","#003b00","#003500",
  "#002f00","#002900","#002300","#001d00","#001700",
  "#001100","#000b00","#000500","#003300","#002a00",
  "#002000","#001600","#001000","#000a00","#000600",
  "#001f00","#001800","#001200","#000c00","#000800",
];

/**
 * Returns an index (0-24) within a 25-shade array based on
 * how far `value` is through the range [rangeStart, rangeEnd].
 */
function shadeIndex(value: number, rangeStart: number, rangeEnd: number): number {
  const span = rangeEnd - rangeStart;
  const offset = Math.min(Math.max(value - rangeStart, 0), span);
  // Map offset to 0-24 inclusive
  return Math.round((offset / span) * 24);
}

/**
 * Returns the hex colour string for a given completion percentage.
 * Works at 1% granularity. Accepts values above 100 (dark green zone).
 */
export function progressColor(percent: number): string {
  const clamped = Math.max(0, percent);

  if (clamped > 100) {
    // Cap at index 24 for very high overages; use dark green
    return DARK_GREEN_SHADES[Math.min(Math.round(clamped - 100), 24)];
  }

  if (clamped >= 75) {
    return GREEN_SHADES[shadeIndex(clamped, 75, 100)];
  }

  if (clamped >= 50) {
    return YELLOW_SHADES[shadeIndex(clamped, 50, 75)];
  }

  if (clamped >= 25) {
    return ORANGE_SHADES[shadeIndex(clamped, 25, 50)];
  }

  // 0-24
  return RED_SHADES[shadeIndex(clamped, 0, 25)];
}
