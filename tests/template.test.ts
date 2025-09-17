import { describe, expect, it } from "vitest";
import { formatTemplate } from "../src/utils/template";

describe("formatTemplate", () => {
  it("replaces placeholders with provided values", () => {
    const template = "Hello {{name}}, welcome to {{place}}!";
    const result = formatTemplate(template, { name: "Alice", place: "Wonderland" });
    expect(result).toBe("Hello Alice, welcome to Wonderland!");
  });

  it("omits placeholders with undefined values", () => {
    const template = "Value: {{defined}} Missing: {{missing}}.";
    const result = formatTemplate(template, { defined: "here", missing: undefined });
    expect(result).toBe("Value: here Missing: .");
  });

  it("supports dotted keys and numeric values", () => {
    const template = "Path: {{file.name}} Count: {{count}}";
    const result = formatTemplate(template, { "file.name": "note.md", count: 3 });
    expect(result).toBe("Path: note.md Count: 3");
  });
});
