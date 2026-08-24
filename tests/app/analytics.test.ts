import { describe, expect, it } from "vitest";

import {
  isPublicAnalyticsPath,
  parseAnalyticsConsent,
  resolveGoogleAnalyticsId,
} from "@/lib/analytics";

describe("Google Analytics configuration", () => {
  it("normalizes a valid GA4 Measurement ID", () => {
    expect(resolveGoogleAnalyticsId("  g-55f5pcd39g  ")).toBe(
      "G-55F5PCD39G",
    );
  });

  it.each([undefined, "", "UA-123456-1", "G-ABC", "G-invalid-id"])(
    "rejects an invalid Measurement ID: %s",
    (measurementId) => {
      expect(resolveGoogleAnalyticsId(measurementId)).toBeNull();
    },
  );

  it.each(["/", "/blog", "/blog/um-texto", "/privacidade"])(
    "allows analytics on a measured public path: %s",
    (pathname) => {
      expect(isPublicAnalyticsPath(pathname)).toBe(true);
    },
  );

  it.each([
    null,
    "/newsletter/confirmar",
    "/newsletter/confirmado",
    "/atelier-secreto",
    "/atelier-secreto/painel",
  ])("keeps analytics off sensitive or unlisted paths: %s", (pathname) => {
    expect(isPublicAnalyticsPath(pathname)).toBe(false);
  });

  it("accepts only persisted consent values", () => {
    expect(parseAnalyticsConsent("granted")).toBe("granted");
    expect(parseAnalyticsConsent("denied")).toBe("denied");
    expect(parseAnalyticsConsent("yes")).toBeNull();
    expect(parseAnalyticsConsent(null)).toBeNull();
  });
});
