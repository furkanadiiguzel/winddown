import { NextRequest, NextResponse } from "next/server";
import { IntakeStateSchema } from "@/schemas/intake";
import { getTemplate } from "@/lib/pdf/form-template-registry";
import { fillPdf } from "@/lib/pdf";
import wyomingConfig from "@/config/wyoming";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "-")
    .replace(/ /g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_request", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const parsed = IntakeStateSchema.safeParse(
      (body as Record<string, unknown>)?.intakeState
    );

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      console.log({ latencyMs: Date.now() - start, status: 422, errorClass: "validation_failed" });
      return NextResponse.json(
        { error: "validation_failed", details },
        { status: 422 }
      );
    }

    const intakeState = parsed.data;
    const template = getTemplate(intakeState.entityType);

    if (!template) {
      console.log({ latencyMs: Date.now() - start, status: 422, errorClass: "unsupported_entity_type" });
      return NextResponse.json(
        {
          error: "unsupported_entity_type",
          entityType: intakeState.entityType,
          message: "Winddown does not support this entity type. Please use the Wyoming Secretary of State forms page.",
          sosFormsUrl: wyomingConfig.sosFormsUrl,
        },
        { status: 422 }
      );
    }

    if (!template.supportedByProduct) {
      console.log({ latencyMs: Date.now() - start, status: 422, errorClass: "unsupported_entity_type" });
      return NextResponse.json(
        {
          error: "unsupported_entity_type",
          entityType: intakeState.entityType,
          message: "Winddown does not support this entity type. Please use the Wyoming Secretary of State forms page.",
          sosFormsUrl: wyomingConfig.sosFormsUrl,
        },
        { status: 422 }
      );
    }

    const pdfBytes = await fillPdf({
      template,
      intakeState,
      mode: intakeState.mode,
    });

    const filename = `${sanitizeFilename(intakeState.companyLegalName)}-articles-of-dissolution.pdf`;

    console.log({ latencyMs: Date.now() - start, status: 200 });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const errorClass = error instanceof Error ? error.constructor.name : "UnknownError";
    console.log({ latencyMs: Date.now() - start, status: 500, errorClass });
    return NextResponse.json(
      { error: "internal_error", message: "PDF generation failed." },
      { status: 500 }
    );
  }
}
