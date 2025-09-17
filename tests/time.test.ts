import { describe, expect, it } from "vitest";
import { formatDateForFile, formatDateTimeISO } from "../src/utils/time";

describe("time utils", () => {
  it("formats date for filenames with zero padding", () => {
    const date = new Date("2024-03-05T07:08:09Z");
    const result = formatDateForFile(date);
    expect(result).toBe("2024-03-05 07-08-09");
  });

  it("delegates to toISOString for ISO format", () => {
    const date = new Date();
    expect(formatDateTimeISO(date)).toBe(date.toISOString());
  });
});
