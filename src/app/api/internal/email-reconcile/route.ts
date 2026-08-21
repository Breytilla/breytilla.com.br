import { logServerError } from "@/server/email/http";
import {
  isAuthorizedInternalRequest,
  unauthorizedInternalResponse,
} from "@/server/email/internal-auth";
import { reconcileMarketingContacts } from "@/server/email/reconciliation";

export const runtime = "nodejs";

/** Reconciles one bounded provider-to-database audience page. */
async function handleReconciliationRequest(request: Request): Promise<Response> {
  try {
    if (!isAuthorizedInternalRequest(request)) {
      return unauthorizedInternalResponse();
    }

    const result = await reconcileMarketingContacts();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    logServerError("email-reconciliation", error);
    return Response.json(
      { ok: false, error: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}

/** Vercel Cron invokes configured paths with GET. */
export async function GET(request: Request): Promise<Response> {
  return handleReconciliationRequest(request);
}

/** Keeps compatibility with external schedulers and manual operations. */
export async function POST(request: Request): Promise<Response> {
  return handleReconciliationRequest(request);
}
