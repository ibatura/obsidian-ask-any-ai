import { describe, it, expect } from "vitest";
import { TEMPLATE_PARAM_DOCS, buildExampleFrontmatter } from "./templateReference";

const EXPECTED_KEYS = [
  "ai-llm",
  "ai-model",
  "ai-result-heading",
  "ai-insert-position",
  "ai-debug",
  "ai-include-inline-prompt",
  "ai-include-note-names",
  "ai-include-note-aliases",
];

describe("TEMPLATE_PARAM_DOCS", () => {
  it("documents exactly the eight ai-* keys, in order", () => {
    expect(TEMPLATE_PARAM_DOCS.map(d => d.key)).toEqual(EXPECTED_KEYS);
  });

  it("has all fields populated for every entry", () => {
    for (const doc of TEMPLATE_PARAM_DOCS) {
      expect(doc.type.length).toBeGreaterThan(0);
      expect(doc.overridesSetting.length).toBeGreaterThan(0);
      expect(doc.overridesDetail.length).toBeGreaterThan(0);
      expect(doc.description.length).toBeGreaterThan(0);
      expect(doc.example.length).toBeGreaterThan(0);
    }
  });

  it("lists the allowed values for ai-insert-position", () => {
    const doc = TEMPLATE_PARAM_DOCS.find(d => d.key === "ai-insert-position");
    expect(doc?.type).toContain("at-cursor");
    expect(doc?.type).toContain("after-selection");
    expect(doc?.type).toContain("end-of-file");
  });
});

describe("buildExampleFrontmatter", () => {
  it("wraps every key in a --- delimited block", () => {
    const out = buildExampleFrontmatter();
    const lines = out.split("\n");
    expect(lines[0]).toBe("---");
    expect(lines[lines.length - 1]).toBe("---");
    for (const doc of TEMPLATE_PARAM_DOCS) {
      expect(out).toContain(`${doc.key}: ${doc.example}`);
    }
  });
});
