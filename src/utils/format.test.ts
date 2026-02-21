import { describe, expect, it } from "vitest";
import { formatDuration, formatHours, formatMinutes, formatStudyTime, percentLabel } from "@/utils/format";

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

describe("formatStudyTime", () => {
  it("matches required timer format examples", () => {
    expect(formatStudyTime(8)).toBe("8s");
    expect(formatStudyTime(5 * 60 + 3)).toBe("5m 3s");
    expect(formatStudyTime(0)).toBe("0s");
    expect(formatStudyTime(60 * 60 + 9)).toBe("1h 0m 9s");
    expect(formatStudyTime(2 * 60 * 60 + 4 * 60)).toBe("2h 4m 0s");
    expect(formatStudyTime(3 * 60 * 60)).toBe("3h 0m 0s");
  });

  it("always keeps seconds and never pads values", () => {
    expect(formatStudyTime(60)).toBe("1m 0s");
    expect(formatStudyTime(60 * 60 + 2 * 60 + 3)).toBe("1h 2m 3s");
    expect(formatStudyTime(9)).toBe("9s");
  });

  it("clamps invalid and negative input to zero", () => {
    expect(formatStudyTime(-5)).toBe("0s");
    expect(formatStudyTime(Number.NaN)).toBe("0s");
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

