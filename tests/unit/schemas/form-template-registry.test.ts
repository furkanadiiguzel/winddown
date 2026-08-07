import { describe, it, expect } from "vitest";
import { getTemplate, getSupportedTemplate } from "@/lib/pdf/form-template-registry";

describe("FormTemplate registry", () => {
  it("getTemplate('wyoming-llc') returns the LLC template", () => {
    const t = getTemplate("wyoming-llc");
    expect(t).toBeDefined();
    expect(t?.entityType).toBe("wyoming-llc");
    expect(t?.supportedByProduct).toBe(true);
  });

  it("getTemplate('wyoming-corp') returns the corp template", () => {
    const t = getTemplate("wyoming-corp");
    expect(t).toBeDefined();
    expect(t?.entityType).toBe("wyoming-corp");
    expect(t?.supportedByProduct).toBe(false);
  });

  it("getTemplate returns undefined for unknown entity type", () => {
    expect(getTemplate("unknown-entity")).toBeUndefined();
  });

  it("getSupportedTemplate returns LLC (supported)", () => {
    const t = getSupportedTemplate("wyoming-llc");
    expect(t).toBeDefined();
  });

  it("getSupportedTemplate returns undefined for corp (not yet supported)", () => {
    const t = getSupportedTemplate("wyoming-corp");
    expect(t).toBeUndefined();
  });

  it("LLC template fieldMap does not include the certification checkbox field", () => {
    const t = getTemplate("wyoming-llc")!;
    const fieldNames = Object.values(t.fieldMap).map((e) =>
      "pdfFieldName" in e ? e.pdfFieldName : ""
    );
    // "Certification check box" is the only prohibited field (signature is ink-only)
    const hasCertificationCheckbox = fieldNames.some((n) =>
      /certification check box/i.test(n)
    );
    expect(hasCertificationCheckbox).toBe(false);
  });
});
