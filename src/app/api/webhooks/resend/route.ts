import {
  inputErrorResponse,
  logServerError,
  readTextBody,
} from "@/server/email/http";
import { verifyResendWebhook } from "@/server/email/resend";
import { handleResendWebhook } from "@/server/email/webhooks";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1_048_576;

/** Verifies the untouched request body before applying a deduplicated event. */
export async function POST(request: Request): Promise<Response> {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return Response.json(
      { ok: false, error: "INVALID_WEBHOOK" },
      { status: 400 },
    );
  }

  let payload: string;
  try {
    payload = await readTextBody(request, MAX_WEBHOOK_BYTES);
  } catch (error) {
    return (
      inputErrorResponse(error) ??
      Response.json(
        { ok: false, error: "INVALID_WEBHOOK" },
        { status: 400 },
      )
    );
  }

  let event;
  try {
    event = verifyResendWebhook({ payload, id, timestamp, signature });
  } catch {
    return Response.json(
      { ok: false, error: "INVALID_WEBHOOK" },
      { status: 400 },
    );
  }

  try {
    const result = await handleResendWebhook({
      providerEventId: id,
      event,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    logServerError("resend-webhook", error);
    return Response.json(
      { ok: false, error: "WEBHOOK_PROCESSING_FAILED" },
      { status: 500 },
    );
  }
}
