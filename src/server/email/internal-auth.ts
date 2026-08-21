import { secureTokenEquals } from "./crypto";
import { getCronEnv } from "./env";

/** Authenticates an internal scheduler request with the shared Bearer secret. */
export function isAuthorizedInternalRequest(request: Request): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const suppliedToken = authorization.slice("Bearer ".length);
  return secureTokenEquals(suppliedToken, getCronEnv().CRON_SECRET);
}

/** Returns the uniform unauthorized response used by internal cron handlers. */
export function unauthorizedInternalResponse(): Response {
  return Response.json(
    { ok: false, error: "UNAUTHORIZED" },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    },
  );
}
