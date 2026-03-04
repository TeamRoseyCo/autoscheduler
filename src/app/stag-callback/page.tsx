"use client";

import { useEffect, useState } from "react";
import { saveStagTicket } from "@/lib/actions/uni/stag";

export default function StagCallbackPage() {
  const [status, setStatus] = useState("Connecting to STAG...");
  const [error, setError] = useState(false);

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);

        // STAG redirects with ?stagUserTicket=TICKET&stagUserInfo=BASE64
        let ticket = params.get("stagUserTicket") || "";

        // Fallback: try WSCOOKIE from cookie
        if (!ticket) {
          const cookies = document.cookie.split(";");
          for (const c of cookies) {
            const [name, val] = c.trim().split("=");
            if (name === "WSCOOKIE" && val) {
              ticket = val;
              break;
            }
          }
        }

        // Try to extract user info from the stagUserInfo param
        let stagUserFromInfo = "";
        let osCisloFromInfo = "";
        const stagUserInfoB64 = params.get("stagUserInfo");
        if (stagUserInfoB64) {
          try {
            const decoded = JSON.parse(atob(stagUserInfoB64));
            // stagUserInfo contains: { userName, jmeno, prijmeni, role: [...] }
            stagUserFromInfo = decoded?.userName || "";
            // Find student role
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

        if (!ticket) {
          setError(true);
          setStatus("Could not get login ticket from STAG. Please try again.");
          return;
        }

        setStatus("Saving connection...");

        const result = await saveStagTicket(stagUrl, ticket, stagUserFromInfo, osCisloFromInfo);

        if (result.success) {
          setStatus(`Connected as ${result.stagUser || result.osCislo || "student"}! Closing...`);

          if (window.opener) {
            window.opener.postMessage(
              { type: "stag_sso_complete", success: true },
              window.location.origin
            );
          }

          localStorage.removeItem("stag_sso_url");

          setTimeout(() => {
            try { window.close(); } catch { /* ok */ }
          }, 1500);
        }
      } catch (e: any) {
        setError(true);
        setStatus(e.message || "Connection failed");
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#12121c]">
      <div className="text-center p-8 max-w-sm">
        {!error ? (
          <>
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-sm">{status}</p>
          </>
        ) : (
          <>
            <div className="text-3xl mb-4">&#x26A0;&#xFE0F;</div>
            <p className="text-red-400 text-sm mb-4">{status}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 text-xs bg-[#2a2a3c] hover:bg-[#3a3a4c] text-gray-300 rounded-lg"
            >
              Close this window
            </button>
          </>
        )}
      </div>
    </div>
  );
}
