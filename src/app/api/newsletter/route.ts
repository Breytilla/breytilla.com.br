import {
  inputErrorResponse,
  hasAllowedPublicOrigin,
  logServerError,
  readJsonBody,
} from "@/server/email/http";
import { requestNewsletterOptIn } from "@/server/email/newsletter";
import { newsletterRequestSchema } from "@/server/email/validation";

export const runtime = "nodejs";

/** Accepts only explicit marketing consent and always returns a neutral result. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (!hasAllowedPublicOrigin(request, { required: true })) {
      return Response.json(
        { ok: false, error: "FORBIDDEN_ORIGIN" },
        { status: 403 },
      );
    }

    const input = newsletterRequestSchema.parse(await readJsonBody(request));
    await requestNewsletterOptIn(input);

    return Response.json(
      {
        ok: true,
        message:
          "Se o endereço estiver apto, enviaremos uma confirmação por e-mail.",
      },
      { status: 202 },
    );
  } catch (error) {
    const inputResponse = inputErrorResponse(error);
    if (inputResponse) {
      return inputResponse;
    }

    logServerError("newsletter-request", error);
    return Response.json(
      { ok: false, error: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
