export const ANALYTICS_CONSENT_STORAGE_KEY =
  "breytilla.analytics-consent.v1";

export type AnalyticsConsentChoice = "granted" | "denied";

const PUBLIC_ANALYTICS_PREFIXES = ["/blog", "/privacidade"];
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,}$/;

export function parseAnalyticsConsent(
  value: string | null,
): AnalyticsConsentChoice | null {
  return value === "granted" || value === "denied" ? value : null;
}

export function resolveGoogleAnalyticsId(
  value: string | undefined,
): string | null {
  const measurementId = value?.trim().toUpperCase();

  return measurementId && GA_MEASUREMENT_ID_PATTERN.test(measurementId)
    ? measurementId
    : null;
}

export function isPublicAnalyticsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;

  return PUBLIC_ANALYTICS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
