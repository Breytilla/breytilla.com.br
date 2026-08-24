import { AnalyticsConsent } from "@/components/analytics-consent";
import { resolveGoogleAnalyticsId } from "@/lib/analytics";

const googleAnalyticsId = resolveGoogleAnalyticsId(
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
);

export function PublicAnalytics() {
  return <AnalyticsConsent measurementId={googleAnalyticsId} />;
}
