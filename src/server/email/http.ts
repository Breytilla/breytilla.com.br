import { z } from "zod";

import { getAppEnv } from "./env";

const MAX_JSON_BODY_BYTES = 16_384;

export class RequestInputError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "RequestInputError";
  }
}

/** Reads a request stream without buffering more bytes than the given limit. */
export async function readTextBody(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestInputError(413, "PAYLOAD_TOO_LARGE");
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new RequestInputError(413, "PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString(
    "utf8",
  );
}

/** Reads one small JSON body while enforcing media type and size limits. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new RequestInputError(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const rawBody = await readTextBody(request, MAX_JSON_BODY_BYTES);

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new RequestInputError(400, "INVALID_JSON");
  }
}

/** Maps expected input failures to a public response without echoing submitted data. */
export function inputErrorResponse(error: unknown): Response | undefined {
  if (error instanceof RequestInputError) {
    return Response.json(
      { ok: false, error: error.code },
      { status: error.status },
    );
  }

  if (error instanceof z.ZodError) {
    return Response.json(
      { ok: false, error: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  return undefined;
}

/** Validates the browser Origin; public mutations may require it explicitly. */
export function hasAllowedPublicOrigin(
  request: Request,
  options: { required?: boolean } = {},
): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return options.required !== true;
  }

  try {
    return new URL(origin).origin === new URL(getAppEnv().APP_URL).origin;
  } catch {
    return false;
  }
}

/** Logs only an error class/code, excluding request bodies, addresses, and SQL. */
export function logServerError(context: string, error: unknown): void {
  const errorType =
    error instanceof Error ? error.name || "Error" : "UnknownError";
  console.error(`[${context}]`, { errorType });
}
