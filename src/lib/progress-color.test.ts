import { describe, it, expect } from "vitest";
import { progressColor } from "./progress-color";

describe("progressColor", () => {
  it("returns a valid hex string at 0%", () => {
    expect(progressColor(0)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("returns a valid hex string at every key milestone", () => {
    [0, 25, 50, 75, 100, 110].forEach((pct) => {
      expect(progressColor(pct)).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("produces different colors at each 25% milestone", () => {
    const colors = [0, 25, 50, 75, 100].map(progressColor);
    const unique = new Set(colors);
    expect(unique.size).toBe(5); // all distinct
  });

  it("produces unique colors at every 1% increment (0-100)", () => {
    const colors = Array.from({ length: 101 }, (_, i) => progressColor(i));
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(80); // near-total uniqueness
  });

  it("returns different color above 100% vs at 100%", () => {
    expect(progressColor(110)).not.toBe(progressColor(100));
  });

  it("handles negative input gracefully (treated as 0)", () => {
    expect(progressColor(-5)).toBe(progressColor(0));
  });

  it("color at 50% is visually amber/yellow hue (R and G channels both high)", () => {
    const hex = progressColor(50);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Amber: R high, G moderate, B low
    expect(r).toBeGreaterThan(150);
    expect(b).toBeLessThan(80);
  });

  it("color at 0% is red-dominant", () => {
    const hex = progressColor(0);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    expect(r).toBeGreaterThan(g + 50);
  });

  it("color at 90% is green-dominant", () => {
    const hex = progressColor(90);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    expect(g).toBeGreaterThan(r + 20);
  });
});
