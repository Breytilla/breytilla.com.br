import { getAppEnv } from "@/server/email/env";
import {
  hasAllowedPublicOrigin,
  logServerError,
  readTextBody,
} from "@/server/email/http";
import { confirmNewsletterSubscription } from "@/server/email/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resultRedirect(result: "confirmed" | "invalid"): Response {
  const destination = new URL("/newsletter/confirmado", getAppEnv().APP_URL);
  destination.searchParams.set("status", result);
  return Response.redirect(destination, 303);
}

function tokenLooksValid(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Opens an explicit confirmation screen; GET never changes consent state. */
export function GET(request: Request): Response {
  const token = new URL(request.url).searchParams.get("token") ?? "";

  if (!tokenLooksValid(token)) {
    return resultRedirect("invalid");
  }

  const destination = new URL("/newsletter/confirmar", getAppEnv().APP_URL);
  destination.searchParams.set("token", token);
  return Response.redirect(destination, 303);
}

/** Consumes the token only after the visitor explicitly submits the form. */
export async function POST(request: Request): Promise<Response> {
  if (!hasAllowedPublicOrigin(request, { required: true })) {
    return Response.json(
      { ok: false, error: "FORBIDDEN_ORIGIN" },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    return resultRedirect("invalid");
  }

  let rawBody: string;
  try {
    rawBody = await readTextBody(request, 2_048);
  } catch {
    return resultRedirect("invalid");
  }
  const token = new URLSearchParams(rawBody).get("token") ?? "";

  try {
    const result = await confirmNewsletterSubscription(token);
    return resultRedirect(result);
  } catch (error) {
    logServerError("newsletter-confirmation", error);

    try {
      return resultRedirect("invalid");
    } catch {
      return Response.json(
        { ok: false, error: "SERVICE_UNAVAILABLE" },
        { status: 503 },
      );
    }
  }
}
