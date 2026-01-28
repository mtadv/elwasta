declare global {
    interface Window {
      gtag?: (...args: unknown[]) => void;
    }
  }
  
  export function trackEvent(
    eventName: string,
    params: Record<string, unknown> = {}
  ) {
    if (typeof window === "undefined") return;
    if (!window.gtag) return;
  
    window.gtag("event", eventName, params);
  }
  