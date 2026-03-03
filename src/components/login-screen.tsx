"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

function isElectron(): boolean {
  return typeof window !== "undefined" && navigator.userAgent.includes("Electron");
}

export function LoginScreen() {
  const [waitingForBrowser, setWaitingForBrowser] = useState(false);

  // Poll for session handoff when waiting for browser auth
  useEffect(() => {
    if (!waitingForBrowser) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch("/api/auth/electron-handoff");
          const data = await res.json();
          if (data.token) {
            // Session exists in DB — reload to pick it up
            // Set the cookie so NextAuth recognizes us
            document.cookie = `authjs.session-token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
            window.location.reload();
            return;
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [waitingForBrowser]);

  const handleSignIn = useCallback(() => {
    if (isElectron()) {
      // Open OAuth in system browser instead of Electron window
      window.open("/api/auth/signin/google", "_blank");
      setWaitingForBrowser(true);
    } else {
      signIn("google");
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#12121c]">
      <div className="w-full max-w-sm space-y-8 rounded-xl bg-[#1e1e30] border border-[#2a2a3c] p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">AutoScheduler</h1>
          <p className="mt-2 text-sm text-gray-400">
            AI-powered calendar scheduling. Add tasks and let AI find the
            perfect time slots in your Google Calendar.
          </p>
        </div>

        {waitingForBrowser ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
              <span className="text-sm text-gray-300">Waiting for browser sign-in...</span>
            </div>
            <p className="text-xs text-gray-500">
              Complete the Google sign-in in your browser, then this page will update automatically.
            </p>
            <button
              onClick={() => setWaitingForBrowser(false)}
              className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#2a2a3c] bg-[#12121c] px-4 py-3 text-sm font-medium text-gray-200 shadow-sm transition-colors hover:bg-[#2a2a3c]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}
