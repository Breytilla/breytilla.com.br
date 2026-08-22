import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

const previousRouteKey = process.env.ADMIN_ROUTE_KEY;

afterEach(() => {
  if (previousRouteKey === undefined) {
    delete process.env.ADMIN_ROUTE_KEY;
  } else {
    process.env.ADMIN_ROUTE_KEY = previousRouteKey;
  }
});

describe("admin privacy proxy", () => {
  it("adds private anti-indexing headers only to the configured admin path", () => {
    process.env.ADMIN_ROUTE_KEY = "atelier-secreto";

    const response = proxy(
      new NextRequest("https://breytilla.com.br/atelier-secreto/posts"),
    );

    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not expose admin-specific headers on public pages", () => {
    process.env.ADMIN_ROUTE_KEY = "atelier-secreto";

    const response = proxy(new NextRequest("https://breytilla.com.br/blog"));

    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(response.headers.get("cache-control")).toBeNull();
  });
});
