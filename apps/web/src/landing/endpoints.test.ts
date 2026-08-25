import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DOWNLOAD_DESKTOP_RELEASE_ASSET_BASE_URL,
  DOWNLOAD_LINUX_VERSION_FEED_URL,
  DOWNLOAD_MACOS_FALLBACK_URL,
  DOWNLOAD_MACOS_RELEASE_ASSET_BASE_URL,
  DOWNLOAD_MACOS_VERSION_FEED_URL,
  DOWNLOAD_WINDOWS_VERSION_FEED_URL,
} from "./site";
import {
  handleDownloadLinux,
  handleDownloadMacos,
  handleDownloadWindows,
  handleSubscribe,
} from "./endpoints";

describe("marketing download redirect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads desktop releases from the AxeAI repository", () => {
    expect(DOWNLOAD_MACOS_VERSION_FEED_URL).toBe(
      "https://github.com/amitbtcai/axeai-macos/releases/download/desktop-latest/desktop-version.json",
    );
    expect(DOWNLOAD_MACOS_FALLBACK_URL).toBe(
      "https://github.com/amitbtcai/axeai-macos/releases/tag/desktop-latest",
    );
  });

  it("redirects macOS downloads to the current dmg asset", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          files: [
            { url: "bb-0.0.26-arm64.zip" },
            { url: "bb-0.0.26-arm64.dmg" },
          ],
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleDownloadMacos(
      new Request("https://getbb.app/download/macos?placement=hero"),
      {},
      vi.fn(),
    );

    expect(fetchMock).toHaveBeenCalledWith(DOWNLOAD_MACOS_VERSION_FEED_URL, {
      headers: { accept: "application/json" },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `${DOWNLOAD_MACOS_RELEASE_ASSET_BASE_URL}/bb-0.0.26-arm64.dmg`,
    );
  });

  it("falls back to the release page when the feed has no dmg", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ files: [{ url: "notes.txt" }] }));
      }),
    );

    const response = await handleDownloadMacos(
      new Request("https://getbb.app/download/macos"),
      {},
      vi.fn(),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(DOWNLOAD_MACOS_FALLBACK_URL);
  });

  it.each([
    {
      asset: "AxeAI-0.39.6-x86_64.AppImage",
      feed: DOWNLOAD_LINUX_VERSION_FEED_URL,
      handle: handleDownloadLinux,
    },
    {
      asset: "AxeAI-0.39.6-x64.exe",
      feed: DOWNLOAD_WINDOWS_VERSION_FEED_URL,
      handle: handleDownloadWindows,
    },
  ])(
    "redirects to the current $asset release",
    async ({ asset, feed, handle }) => {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ files: [{ url: asset }] })),
      );
      vi.stubGlobal("fetch", fetchMock);

      const response = await handle();

      expect(fetchMock).toHaveBeenCalledWith(feed, {
        headers: { accept: "application/json" },
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        `${DOWNLOAD_DESKTOP_RELEASE_ASSET_BASE_URL}/${asset}`,
      );
    },
  );

  it("tracks the click through waitUntil when a PostHog key is set", async () => {
    const fetchMock = vi.fn(
      async (..._args: Parameters<typeof fetch>) => new Response("{}"),
    );
    vi.stubGlobal("fetch", fetchMock);
    const waitUntil = vi.fn<(promise: Promise<void>) => void>();

    await handleDownloadMacos(
      new Request("https://getbb.app/download/macos?placement=nav"),
      { LANDING_POSTHOG_KEY: "phc_test" },
      waitUntil,
    );

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0]?.[0];
    const captureCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("posthog"),
    );
    expect(captureCall).toBeTruthy();
  });
});

describe("marketing subscribe endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function subscribeRequest(email: unknown): Request {
    return new Request("https://getbb.app/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }

  it("reports not-configured without Resend credentials", async () => {
    const response = await handleSubscribe(subscribeRequest("a@b.co"), {});
    expect(response.status).toBe(503);
  });

  it("adds a valid email to the Resend audience", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleSubscribe(subscribeRequest("a@b.co"), {
      RESEND_API_KEY: "re_test",
      RESEND_AUDIENCE_ID: "aud_test",
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/audiences/aud_test/contacts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects malformed emails without calling Resend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleSubscribe(subscribeRequest("not-an-email"), {
      RESEND_API_KEY: "re_test",
      RESEND_AUDIENCE_ID: "aud_test",
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
