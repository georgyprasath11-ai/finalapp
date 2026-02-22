import { describe, expect, it } from "vitest";
import { fisherYatesShuffle } from "@/lib/shuffle";

describe("fisherYatesShuffle", () => {
  it("returns a new array without mutating the source", () => {
    const source = [1, 2, 3, 4];
    const snapshot = [...source];

    const result = fisherYatesShuffle(source, () => 0.42);

    expect(result).not.toBe(source);
    expect(source).toEqual(snapshot);
    expect(result).toHaveLength(source.length);
  });

  it("produces deterministic output with a deterministic random function", () => {
    const values = [0.1, 0.7, 0.3];
    let pointer = 0;
    const random = () => values[pointer++] ?? 0;

    const result = fisherYatesShuffle([1, 2, 3, 4], random);

    expect(result).toEqual([2, 4, 3, 1]);
  });

  it("handles empty and single-item arrays", () => {
    expect(fisherYatesShuffle<number>([])).toEqual([]);
    expect(fisherYatesShuffle([7])).toEqual([7]);
  });
});
