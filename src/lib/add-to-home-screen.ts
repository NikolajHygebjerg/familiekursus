export type Platform = "ios" | "android" | "other";
export type Browser = "safari" | "chrome" | "firefox" | "edge" | "samsung" | "other";

export function detectPlatform(userAgent: string): Platform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "other";
}

export function detectBrowser(userAgent: string): Browser {
  if (/samsungbrowser/i.test(userAgent)) return "samsung";
  if (/edgios|edga|edg\//i.test(userAgent)) return "edge";
  if (/fxios|firefox/i.test(userAgent)) return "firefox";
  if (/crios|chrome/i.test(userAgent)) return "chrome";
  if (/safari/i.test(userAgent)) return "safari";
  return "other";
}

const BROWSER_LABELS: Record<Browser, string> = {
  safari: "Safari",
  chrome: "Chrome",
  firefox: "Firefox",
  edge: "Microsoft Edge",
  samsung: "Samsung Internet",
  other: "din browser",
};

export function describeUserDevice(platform: Platform, browser: Browser): string {
  if (platform === "ios") {
    return browser === "safari"
      ? "iPhone/iPad med Safari"
      : `iPhone/iPad med ${BROWSER_LABELS[browser]} (Safari anbefales)`;
  }
  if (platform === "android") {
    return `Android med ${BROWSER_LABELS[browser]}`;
  }
  return `Enhed: computer eller tablet · Browser: ${BROWSER_LABELS[browser]}`;
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia("(display-mode: standalone)").matches || nav.standalone);
}

export type HomeScreenGuideContent = {
  deviceDescription: string;
  steps: string[];
  intro: string;
  footnote?: string;
};

export function getHomeScreenGuideContent(platform: Platform, browser: Browser): HomeScreenGuideContent {
  const deviceDescription = describeUserDevice(platform, browser);

  if (platform === "ios" && browser === "safari") {
    return {
      deviceDescription,
      intro: "Sådan gemmer du Familiekursus på hjemmeskærmen i Safari:",
      steps: [
        "Tryk på Del-ikonet (firkant med pil opad) nederst på skærmen.",
        "Rul ned og vælg «Føj til hjemmeskærm».",
        "Tryk «Tilføj» øverst til højre.",
      ],
    };
  }

  if (platform === "ios") {
    return {
      deviceDescription,
      intro: "Åbn siden i Safari, og vælg «Føj til hjemmeskærm» fra Del-menuen.",
      steps: [
        "Kopier adressen og åbn den i Safari.",
        "Tryk Del-ikonet nederst.",
        "Vælg «Føj til hjemmeskærm» og tryk «Tilføj».",
      ],
      footnote: "På iPhone/iPad kræver Apple typisk Safari til at gemme på hjemmeskærmen.",
    };
  }

  if (platform === "android" && browser === "chrome") {
    return {
      deviceDescription,
      intro: "Sådan installerer du fra Chrome på Android:",
      steps: [
        "Tryk menuen (tre prikker) øverst til højre.",
        "Vælg «Installer app» eller «Føj til startskærm».",
        "Bekræft tilføjelsen.",
      ],
    };
  }

  return {
    deviceDescription,
    intro: "Sådan gemmer du på startskærmen:",
    steps: [
      "Åbn browserens menu.",
      "Vælg «Installer app» eller «Føj til startskærm».",
      "Bekræft tilføjelsen.",
    ],
    footnote: "Teksten kan variere efter browser og version.",
  };
}
