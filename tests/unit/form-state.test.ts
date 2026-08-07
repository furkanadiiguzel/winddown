/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useFormState } from "@/lib/form-state";
import { initialFormState } from "@/schemas/form-state";

// Reset store before each test
beforeEach(() => {
  // Clear sessionStorage
  sessionStorage.clear();
  // Reset the store to initial state
  useFormState.setState({ ...initialFormState });
});

describe("FormState store — reset()", () => {
  it("clears all fields to initial values after reset()", () => {
    // Set some state
    useFormState.setState({
      signerName: "Jane Doe",
      signerTitle: "Manager",
      certificationAffirmed: true,
      userConfirmedReview: true,
    });

    // Call reset
    useFormState.getState().reset();

    const state = useFormState.getState();
    expect(state.signerName).toBe(initialFormState.signerName);
    expect(state.signerTitle).toBe(initialFormState.signerTitle);
    expect(state.certificationAffirmed).toBe(initialFormState.certificationAffirmed);
    expect(state.userConfirmedReview).toBe(initialFormState.userConfirmedReview);
    expect(state.flowStep).toBe(initialFormState.flowStep);
    expect(state.analysisMode).toBe(initialFormState.analysisMode);
    expect(state.extractedFields).toEqual(initialFormState.extractedFields);
    expect(state.stateConfirmedWyoming).toBe(initialFormState.stateConfirmedWyoming);
    expect(state.entityType).toBe(initialFormState.entityType);
    expect(state.authorizationAffirmed).toBe(initialFormState.authorizationAffirmed);
    expect(state.manualEntryMode).toBe(initialFormState.manualEntryMode);
  });

  it("removes winddown-form-state from sessionStorage after reset()", () => {
    // Seed sessionStorage
    sessionStorage.setItem("winddown-form-state", JSON.stringify({ some: "data" }));

    useFormState.getState().reset();

    expect(sessionStorage.getItem("winddown-form-state")).toBeNull();
  });
});

describe("FormState store — setFieldValue()", () => {
  it("resets certificationAffirmed to false when any field is changed", () => {
    useFormState.setState({ certificationAffirmed: true, userConfirmedReview: false });

    useFormState.getState().setFieldValue("signerName", "New Name");

    expect(useFormState.getState().certificationAffirmed).toBe(false);
  });

  it("resets userConfirmedReview to false when any field is changed", () => {
    useFormState.setState({ certificationAffirmed: false, userConfirmedReview: true });

    useFormState.getState().setFieldValue("signerName", "New Name");

    expect(useFormState.getState().userConfirmedReview).toBe(false);
  });

  it("resets both confirmation flags simultaneously when any field is changed", () => {
    useFormState.setState({ certificationAffirmed: true, userConfirmedReview: true });

    useFormState.getState().setFieldValue("signerTitle", "CEO");

    expect(useFormState.getState().certificationAffirmed).toBe(false);
    expect(useFormState.getState().userConfirmedReview).toBe(false);
  });

  it("updates top-level string fields", () => {
    useFormState.getState().setFieldValue("signerName", "Alice Smith");

    expect(useFormState.getState().signerName).toBe("Alice Smith");
  });
});

describe("FormState store — resetConfirmations()", () => {
  it("resets both confirmation flags to false", () => {
    useFormState.setState({ certificationAffirmed: true, userConfirmedReview: true });

    useFormState.getState().resetConfirmations();

    expect(useFormState.getState().certificationAffirmed).toBe(false);
    expect(useFormState.getState().userConfirmedReview).toBe(false);
  });
});

// T029 — Snapshot-bound confirmation reset integration test
describe("T029 — snapshot-bound confirmation reset", () => {
  it("sets certificationAffirmed to false after setFieldValue when it was true", () => {
    // Set certificationAffirmed: true in store
    useFormState.setState({ certificationAffirmed: true });

    // Call setFieldValue('signerName', 'New Name')
    useFormState.getState().setFieldValue("signerName", "New Name");

    // Assert certificationAffirmed is now false
    expect(useFormState.getState().certificationAffirmed).toBe(false);
  });
});
