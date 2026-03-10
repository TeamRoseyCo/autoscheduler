"use client";

import { useEffect, useState } from "react";
import { saveStagTicket } from "@/lib/actions/uni/stag";

export default function StagCallbackPage() {
  const [status, setStatus] = useState("Connecting to STAG...");
  const [error, setError] = useState(false);
  const [ticket, setTicket] = useState("");
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);

        // STAG redirects with ?stagUserTicket=TICKET&stagUserInfo=BASE64
        let foundTicket = params.get("stagUserTicket") || "";

        // Fallback: try WSCOOKIE from cookie
        if (!foundTicket) {
          const cookies = document.cookie.split(";");
          for (const c of cookies) {
            const [name, val] = c.trim().split("=");
            if (name === "WSCOOKIE" && val) {
              foundTicket = val;
              break;
            }
          }
        }

        if (!foundTicket) {
          setError(true);
          setStatus(
            "Could not get login ticket from STAG. " +
            "Make sure you logged in successfully and were redirected back here."
          );
          return;
        }

        // Always show the ticket so user can copy it if auto-save fails
        setTicket(foundTicket);

        // Try to extract user info from the stagUserInfo param
        let stagUserFromInfo = "";
        let osCisloFromInfo = "";
        const stagUserInfoB64 = params.get("stagUserInfo");
        if (stagUserInfoB64) {
          try {
            const decoded = JSON.parse(atob(stagUserInfoB64));
            stagUserFromInfo = decoded?.userName || "";
            const roles = Array.isArray(decoded?.role) ? decoded.role : decoded?.role ? [decoded.role] : [];
            for (const r of roles) {
              if (r.role === "ST") {
                stagUserFromInfo = r.userName || stagUserFromInfo;
                osCisloFromInfo = r.userName || osCisloFromInfo;
                break;
              }
            }
            if (!osCisloFromInfo && roles.length > 0) {
              osCisloFromInfo = roles[0].userName || "";
              stagUserFromInfo = stagUserFromInfo || roles[0].userName || "";
            }
          } catch {
            // ignore parse errors
          }
        }

        const stagUrl = localStorage.getItem("stag_sso_url") || "";

        setStatus("Saving connection...");

        const result = await saveStagTicket(stagUrl, foundTicket, stagUserFromInfo, osCisloFromInfo);

        if (result.success) {
          setDone(true);
          setStatus(`Connected as ${result.stagUser || result.osCislo || "student"}!`);

          if (window.opener) {
            window.opener.postMessage(
              { type: "stag_sso_complete", success: true },
              window.location.origin
            );
          }

          localStorage.removeItem("stag_sso_url");
        }
      } catch (e: any) {
        setError(true);
        setStatus(e.message || "Auto-save failed. Copy your ticket below and paste it in Settings → Manual Ticket.");
      }
    }

    handleCallback();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(ticket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#12121c]">
      <div className="text-center p-8 max-w-md">
        {done ? (
          <>
            <div className="text-3xl mb-4">&#x2705;</div>
            <p className="text-green-400 text-sm mb-4">{status}</p>
            <p className="text-xs text-gray-500 mb-4">You can close this tab and go back to Settings.</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 text-xs bg-[#2a2a3c] hover:bg-[#3a3a4c] text-gray-300 rounded-lg"
            >
              Close
            </button>
          </>
        ) : !error && !ticket ? (
          <>
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-sm">{status}</p>
          </>
        ) : (
          <>
            <div className="text-3xl mb-4">{error ? "\u26A0\uFE0F" : ""}</div>
            {error && <p className="text-red-400 text-sm mb-4">{status}</p>}

            {ticket && (
              <div className="mt-4 text-left">
                <p className="text-xs text-gray-400 mb-2">
                  {error
                    ? "Your ticket was found — copy it and paste it in Settings → STAG → Manual Ticket:"
                    : "Saving..."}
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={ticket}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#1e1e30] border border-[#2a2a3c] text-white text-xs font-mono focus:outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <button
                onClick={() => window.close()}
                className="mt-4 px-4 py-2 text-xs bg-[#2a2a3c] hover:bg-[#3a3a4c] text-gray-300 rounded-lg"
              >
                Close
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
