"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentChoice,
  isPublicAnalyticsPath,
  parseAnalyticsConsent,
} from "@/lib/analytics";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

type AnalyticsConsentProps = {
  measurementId: string | null;
};

type AnalyticsConsentSnapshot = AnalyticsConsentChoice | null | undefined;

const DENIED_AD_CONSENT = {
  ad_personalization: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
} as const;
const CONSENT_CHANGE_EVENT = "breytilla:analytics-consent-change";
let volatileConsent: AnalyticsConsentChoice | null = null;

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

function getConsentSnapshot(): AnalyticsConsentSnapshot {
  try {
    return (
      parseAnalyticsConsent(
        window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
      ) ?? volatileConsent
    );
  } catch {
    return volatileConsent;
  }
}

function getServerConsentSnapshot(): AnalyticsConsentSnapshot {
  return undefined;
}

function queueGoogleCommand(...args: unknown[]) {
  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.dataLayer ??= [];

  if (analyticsWindow.gtag) {
    analyticsWindow.gtag(...args);
    return;
  }

  analyticsWindow.dataLayer.push(args);
}

function prepareGoogleAnalytics() {
  queueGoogleCommand("consent", "default", {
    ...DENIED_AD_CONSENT,
    analytics_storage: "granted",
  });
  queueGoogleCommand("set", "allow_ad_personalization_signals", false);
  queueGoogleCommand("set", "allow_google_signals", false);
}

function updateAnalyticsConsent(choice: AnalyticsConsentChoice) {
  queueGoogleCommand("consent", "update", {
    ...DENIED_AD_CONSENT,
    analytics_storage: choice,
  });
}

function deleteAnalyticsCookies() {
  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=", 1)[0]?.trim())
    .filter((name): name is string =>
      Boolean(name && /^_(?:ga|gid|gat)/.test(name)),
    );

  const hostname = window.location.hostname;
  const domains = new Set<string | null>([null, hostname, `.${hostname}`]);

  if (hostname === "breytilla.com.br" || hostname.endsWith(".breytilla.com.br")) {
    domains.add("breytilla.com.br");
    domains.add(".breytilla.com.br");
  }

  for (const name of cookieNames) {
    for (const domain of domains) {
      const domainAttribute = domain ? `; Domain=${domain}` : "";
      document.cookie = `${name}=; Max-Age=0; Path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}

function persistConsent(choice: AnalyticsConsentChoice) {
  volatileConsent = choice;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
  } catch {
    // The in-memory choice still applies when browser storage is unavailable.
  }

  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

function GoogleAnalyticsWithPrivacyDefaults({ gaId }: { gaId: string }) {
  return (
    <>
      <Script id="breytilla-ga-privacy-defaults" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            'analytics_storage': 'granted',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
          });
          gtag('set', 'allow_ad_personalization_signals', false);
          gtag('set', 'allow_google_signals', false);
        `}
      </Script>
      <GoogleAnalytics gaId={gaId} />
    </>
  );
}

export function AnalyticsConsent({ measurementId }: AnalyticsConsentProps) {
  const pathname = usePathname();
  const isPublicPath = isPublicAnalyticsPath(pathname);
  const choice = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerConsentSnapshot,
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    if (!measurementId || !(window as AnalyticsWindow).gtag) return;

    updateAnalyticsConsent(
      isPublicPath && choice === "granted" ? "granted" : "denied",
    );
  }, [choice, isPublicPath, measurementId]);

  if (!measurementId || !isPublicPath || choice === undefined) return null;

  const showPanel = choice === null || isPanelOpen;

  function choose(nextChoice: AnalyticsConsentChoice) {
    const analyticsWasLoaded = choice === "granted";

    if (nextChoice === "granted") {
      prepareGoogleAnalytics();
      updateAnalyticsConsent("granted");
    } else if ((window as AnalyticsWindow).gtag) {
      updateAnalyticsConsent("denied");
      deleteAnalyticsCookies();
    }

    persistConsent(nextChoice);
    setIsPanelOpen(false);

    if (nextChoice === "denied" && analyticsWasLoaded) {
      window.location.reload();
    }
  }

  return (
    <>
      {choice === "granted" ? (
        <GoogleAnalyticsWithPrivacyDefaults gaId={measurementId} />
      ) : null}

      {showPanel ? (
        <aside
          className="analytics-consent"
          aria-describedby="analytics-consent-description"
          aria-labelledby="analytics-consent-title"
          role="dialog"
        >
          <div className="analytics-consent__copy">
            <p className="analytics-consent__eyebrow">Sua privacidade</p>
            <h2 id="analytics-consent-title">Podemos usar métricas de visita?</h2>
            <p id="analytics-consent-description">
              O Google Analytics nos ajuda a entender quais páginas são úteis.
              Ele só será carregado se você aceitar, e nunca envia o conteúdo
              dos formulários. <Link href="/privacidade">Saiba mais</Link>.
            </p>
          </div>

          <div className="analytics-consent__actions">
            <button
              className="analytics-consent__button analytics-consent__button--secondary"
              onClick={() => choose("denied")}
              type="button"
            >
              Recusar métricas
            </button>
            <button
              className="analytics-consent__button analytics-consent__button--primary"
              onClick={() => choose("granted")}
              type="button"
            >
              Aceitar métricas
            </button>
          </div>

          {choice !== null ? (
            <button
              className="analytics-consent__close"
              onClick={() => setIsPanelOpen(false)}
              type="button"
            >
              Manter escolha atual
            </button>
          ) : null}
        </aside>
      ) : (
        <button
          className="analytics-consent-trigger"
          onClick={() => setIsPanelOpen(true)}
          type="button"
        >
          Preferências de privacidade
        </button>
      )}
    </>
  );
}
