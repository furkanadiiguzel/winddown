import type { FormTemplate } from "@/schemas/form-templates/types";
import { wyomingLlcTemplate } from "@/schemas/form-templates/wyoming-llc";
import { wyomingCorpDirectorsTemplate, wyomingCorpShareholdersTemplate } from "@/schemas/form-templates/wyoming-corp";

const registry = new Map<string, FormTemplate>([
  [wyomingLlcTemplate.entityType, wyomingLlcTemplate],
  [wyomingCorpDirectorsTemplate.entityType, wyomingCorpDirectorsTemplate],
  [wyomingCorpShareholdersTemplate.entityType, wyomingCorpShareholdersTemplate],
]);

export function getTemplate(entityType: string): FormTemplate | undefined {
  return registry.get(entityType);
}

export function getSupportedTemplate(entityType: string): FormTemplate | undefined {
  const template = registry.get(entityType);
  return template?.supportedByProduct ? template : undefined;
}
