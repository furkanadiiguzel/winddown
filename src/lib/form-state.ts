import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { initialFormState } from "@/schemas/form-state";
import type { FormState } from "@/schemas/form-state";
import type { ExtractedField, AbsentField } from "@/schemas/extraction";

interface FormStateActions {
  setFieldValue: (id: string, value: string) => void;
  resetConfirmations: () => void;
  reset: () => void;
}

export type FormStateStore = FormState & FormStateActions;

export const useFormState = create<FormStateStore>()(
  persist(
    (set) => ({
      ...initialFormState,

      setFieldValue: (id: string, value: string) =>
        set((state) => {
          // Update extracted fields if it's in the extractedFields map
          const existingField = state.extractedFields[id];
          if (existingField !== undefined) {
            const updatedField: ExtractedField = {
              fieldId: id,
              value,
              confidence: "manual" in existingField ? (existingField as ExtractedField).confidence : "high",
              evidence: "evidence" in existingField ? (existingField as ExtractedField).evidence : value,
              sourceUrl: "sourceUrl" in existingField ? (existingField as ExtractedField).sourceUrl : "https://winddown.app",
              provenance: "manual",
              userOverridden: true,
            };
            return {
              extractedFields: {
                ...state.extractedFields,
                [id]: updatedField,
              },
              certificationAffirmed: false,
              userConfirmedReview: false,
            };
          }

          // Otherwise update the top-level field
          return {
            [id]: value,
            certificationAffirmed: false,
            userConfirmedReview: false,
          } as Partial<FormState>;
        }),

      resetConfirmations: () =>
        set({
          certificationAffirmed: false,
          userConfirmedReview: false,
        }),

      reset: () => {
        // First set state to initial (persist middleware will try to write to sessionStorage)
        set({ ...initialFormState });
        // Then remove from sessionStorage — must happen after set() so the persist
        // middleware's write happens first (sync), and we then clobber it.
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("winddown-form-state");
        }
      },
    }),
    {
      name: "winddown-form-state",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") {
          return sessionStorage;
        }
        // SSR fallback: no-op storage
        return {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        };
      }),
    }
  )
);

// Helper to get a specific extracted field with userOverridden support
export function getExtractedField(
  extractedFields: FormState["extractedFields"],
  fieldId: string
): ExtractedField | AbsentField | undefined {
  return extractedFields[fieldId];
}
