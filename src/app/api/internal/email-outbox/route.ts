import { logServerError } from "@/server/email/http";
import {
  isAuthorizedInternalRequest,
  unauthorizedInternalResponse,
} from "@/server/email/internal-auth";
import { processEmailOutbox } from "@/server/email/outbox";

export const runtime = "nodejs";

/** Dispatches one bounded outbox batch for an authenticated scheduler. */
async function handleOutboxRequest(request: Request): Promise<Response> {
  try {
    if (!isAuthorizedInternalRequest(request)) {
      return unauthorizedInternalResponse();
    }

    const result = await processEmailOutbox();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    logServerError("email-outbox", error);
    return Response.json(
      { ok: false, error: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}

/** Vercel Cron invokes configured paths with GET. */
export async function GET(request: Request): Promise<Response> {
  return handleOutboxRequest(request);
}

/** Keeps compatibility with external schedulers and manual operations. */
export async function POST(request: Request): Promise<Response> {
  return handleOutboxRequest(request);
}
