"use client";

import { useEffect } from "react";

export default function ServiceNowOauthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      type: "sn-oauth-callback",
      code: params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
      errorDescription: params.get("error_description"),
    };

    if (window.opener && window.location.origin) {
      window.opener.postMessage(payload, window.location.origin);
    }

    window.close();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <h1 className="text-lg font-semibold mb-2">Finishing ServiceNow sign-in</h1>
        <p className="text-sm opacity-80">You can close this window if it does not close automatically.</p>
      </div>
    </main>
  );
}
