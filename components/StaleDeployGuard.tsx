"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "stale-action-reload";

function hasActionHeader(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  return headers.has("next-action");
}

// Server action IDs change on every deploy. A tab opened before a deploy
// calls IDs the new server does not know, so reload once to pick up the new build.
export function StaleDeployGuard() {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      if (
        response.headers.get("x-nextjs-action-not-found") === "1" &&
        hasActionHeader(input, init)
      ) {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
          window.location.reload();
        }
      }
      return response;
    };
    const clearFlag = window.setTimeout(
      () => sessionStorage.removeItem(RELOAD_FLAG),
      10_000,
    );
    return () => {
      window.fetch = originalFetch;
      window.clearTimeout(clearFlag);
    };
  }, []);

  return null;
}
