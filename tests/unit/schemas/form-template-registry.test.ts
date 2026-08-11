import { describe, it, expect } from "vitest";
import { getTemplate, getSupportedTemplate } from "@/lib/pdf/form-template-registry";

describe("FormTemplate registry", () => {
  it("getTemplate('wyoming-llc') returns the LLC template", () => {
    const t = getTemplate("wyoming-llc");
    expect(t).toBeDefined();
    expect(t?.entityType).toBe("wyoming-llc");
    expect(t?.supportedByProduct).toBe(true);
  });

  it("getTemplate('wyoming-corp-directors') returns the directors corp template", () => {
    const t = getTemplate("wyoming-corp-directors");
    expect(t).toBeDefined();
    expect(t?.entityType).toBe("wyoming-corp-directors");
    expect(t?.supportedByProduct).toBe(true);
  });

  it("getTemplate('wyoming-corp-shareholders') returns the shareholders corp template", () => {
    const t = getTemplate("wyoming-corp-shareholders");
    expect(t).toBeDefined();
    expect(t?.entityType).toBe("wyoming-corp-shareholders");
    expect(t?.supportedByProduct).toBe(true);
  });

  it("getTemplate returns undefined for unknown entity type", () => {
    expect(getTemplate("unknown-entity")).toBeUndefined();
  });

  it("getSupportedTemplate returns LLC (supported)", () => {
    expect(getSupportedTemplate("wyoming-llc")).toBeDefined();
  });

  it("getSupportedTemplate returns corp-directors (supported)", () => {
    expect(getSupportedTemplate("wyoming-corp-directors")).toBeDefined();
  });

  it("getSupportedTemplate returns corp-shareholders (supported)", () => {
    expect(getSupportedTemplate("wyoming-corp-shareholders")).toBeDefined();
  });

  it("LLC template fieldMap includes the certification checkbox (statutory declaration)", () => {
    const t = getTemplate("wyoming-llc")!;
    const fieldNames = Object.values(t.fieldMap).map((e) =>
      "pdfFieldName" in e ? e.pdfFieldName : ""
    );
    // "Certification check box" = W.S. 17-29-701 statutory declaration; system checks it
    // when certificationAffirmed=true. The SIGNATURE LINE (ink) is not an AcroForm field.
    expect(fieldNames).toContain("Certification check box");
  });
});
