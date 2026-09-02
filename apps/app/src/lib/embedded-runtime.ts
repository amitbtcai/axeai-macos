const EMBEDDED_SERVER_ORIGIN_KEY = "__AXEAI_EMBEDDED_SERVER_ORIGIN__";

type EmbeddedWindow = Window &
  Partial<Record<typeof EMBEDDED_SERVER_ORIGIN_KEY, string>>;

export function setEmbeddedServerOrigin(origin: string): void {
  (window as EmbeddedWindow)[EMBEDDED_SERVER_ORIGIN_KEY] = origin;
}

export function appServerOrigin(): string {
  if (typeof window === "undefined") return "http://localhost";
  return (window as EmbeddedWindow)[EMBEDDED_SERVER_ORIGIN_KEY] ?? window.location.origin;
}

function rewrittenRequestUrl(value: string): string {
  const serverOrigin = appServerOrigin();
  if (serverOrigin === window.location.origin) return value;
  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin) return value;
  return `${serverOrigin}${url.pathname}${url.search}${url.hash}`;
}

export function installEmbeddedFetch(serverOrigin: string): void {
  setEmbeddedServerOrigin(serverOrigin);
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (input instanceof Request) {
      const rewritten = new Request(rewrittenRequestUrl(input.url), input);
      return originalFetch(rewritten, { ...init, credentials: "include" });
    }
    const value = input instanceof URL ? input.toString() : input;
    return originalFetch(rewrittenRequestUrl(value), {
      ...init,
      credentials: "include",
    });
  };
}
