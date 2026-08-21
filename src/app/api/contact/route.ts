import {
  ContactRequestRateLimitError,
  createContactRequest,
} from "@/server/email/contact-requests";
import {
  inputErrorResponse,
  hasAllowedPublicOrigin,
  logServerError,
  readJsonBody,
} from "@/server/email/http";
import { contactRequestSchema } from "@/server/email/validation";

export const runtime = "nodejs";

const acceptedResponse = () =>
  Response.json(
    {
      ok: true,
      message: "Recebemos sua solicitação.",
    },
    { status: 202 },
  );

/** Accepts contact details only; clinical free-text is intentionally unsupported. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (!hasAllowedPublicOrigin(request, { required: true })) {
      return Response.json(
        { ok: false, error: "FORBIDDEN_ORIGIN" },
        { status: 403 },
      );
    }

    const input = contactRequestSchema.parse(await readJsonBody(request));

    await createContactRequest(input);
    return acceptedResponse();
  } catch (error) {
    const inputResponse = inputErrorResponse(error);
    if (inputResponse) {
      return inputResponse;
    }

    if (error instanceof ContactRequestRateLimitError) {
      return Response.json(
        { ok: false, error: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": "3600" },
        },
      );
    }

    logServerError("contact-request", error);
    return Response.json(
      { ok: false, error: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
