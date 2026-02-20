import { describe, expect, it } from "vitest";
import { formatDuration, formatHours, formatMinutes, percentLabel } from "@/utils/format";

describe("formatDuration", () => {
  it("formats sub-hour values as mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(90_000)).toBe("01:30");
    expect(formatDuration(3_599_000)).toBe("59:59");
  });

  it("formats hour values as h mm", () => {
    expect(formatDuration(3_600_000)).toBe("1h 00m");
    expect(formatDuration(3_900_000)).toBe("1h 05m");
    expect(formatDuration(7_205_000)).toBe("2h 00m");
  });
});

describe("formatMinutes", () => {
  it("formats minutes below one hour", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(59)).toBe("59m");
  });

  it("formats minutes at or above one hour", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(125)).toBe("2h 5m");
  });
});

describe("formatHours", () => {
  it("formats whole values without decimals", () => {
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(2)).toBe("2h");
  });

  it("formats decimal values with trimmed trailing zeros", () => {
    expect(formatHours(1.5)).toBe("1.5h");
    expect(formatHours(1.25)).toBe("1.25h");
    expect(formatHours(1.2)).toBe("1.2h");
  });
});

describe("percentLabel", () => {
  it("rounds values to nearest percent", () => {
    expect(percentLabel(42.2)).toBe("42%");
    expect(percentLabel(42.5)).toBe("43%");
  });
});
