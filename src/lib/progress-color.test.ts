import { describe, it, expect } from "vitest";
import { progressColor } from "./progress-color";

describe("progressColor", () => {
  it("returns a red-family color at 0%", () => {
    expect(progressColor(0)).toBe("#FF0000");
  });

  it("returns an orange-family color at 25%", () => {
    expect(progressColor(25)).toBe("#FF4500");
  });

  it("returns a yellow-family color at 50%", () => {
    expect(progressColor(50)).toBe("#FFFF00");
  });

  it("returns a green-family color at 75%", () => {
    expect(progressColor(75)).toBe("#00FF00");
  });

  it("returns a green-family color at 100%", () => {
    expect(progressColor(100)).toBe("#000F00");
  });

  it("returns a dark-green-family color above 100%", () => {
    const color = progressColor(110);
    expect(color).not.toBe(progressColor(100));
    expect(color.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns different colors at 1% increments", () => {
    const colors = Array.from({ length: 25 }, (_, i) => progressColor(i));
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(10); // at minimum 10 unique shades
  });

  it("handles negative input by treating as 0", () => {
    expect(progressColor(-5)).toBe(progressColor(0));
  });
});
