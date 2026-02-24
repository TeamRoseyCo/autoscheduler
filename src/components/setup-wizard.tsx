"use client";

import { useState } from "react";

const steps = [
  {
    title: "Create a Google Cloud Project",
    instructions: [
      'Click the link below to open Google Cloud Console',
      'If prompted, agree to Terms of Service',
      'Click "Select a project" at the top, then "New Project"',
      'Name it anything (e.g. "My Calendar App"), click Create',
      'Make sure your new project is selected at the top',
    ],
    link: "https://console.cloud.google.com/",
    linkText: "Open Google Cloud Console",
  },
  {
    title: "Enable the Google Calendar API",
    instructions: [
      "Click the link below to go to the Calendar API page",
      'Click the big blue "Enable" button',
      "Wait a few seconds for it to activate",
    ],
    link: "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
    linkText: "Open Calendar API page",
  },
  {
    title: "Configure OAuth Consent Screen",
    instructions: [
      "Click the link below",
      'Select "External" and click Create',
      'Fill in App name (e.g. "AutoScheduler") and your email in required fields',
      "Click Save and Continue through all steps",
      'On the "Test users" step, add your own Gmail address',
      "Click Save and Continue, then Back to Dashboard",
    ],
    link: "https://console.cloud.google.com/apis/credentials/consent",
    linkText: "Open OAuth Consent Screen",
  },
  {
    title: "Create OAuth Credentials",
    instructions: [
      "Click the link below",
      'Click "+ Create Credentials" at the top, choose "OAuth client ID"',
      'Application type: "Web application"',
      'Name: anything (e.g. "AutoScheduler")',
      'Under "Authorized redirect URIs", click Add URI',
      "Paste this exact URL:",
    ],
    copyValue: "http://localhost:3000/api/auth/callback/google",
    afterInstructions: [
      "Click Create",
      "A popup will show your Client ID and Client Secret",
      "Copy both values - you'll paste them in the next step",
    ],
    link: "https://console.cloud.google.com/apis/credentials",
    linkText: "Open Credentials page",
  },
  {
    title: "Paste Your Credentials",
    instructions: [
      "Paste the Client ID and Client Secret from the popup below",
      'Then click "Save & Finish"',
    ],
    hasForm: true,
  },
];

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const current = steps[step];

  async function handleSave() {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });
      if (res.ok) {
        setDone(true);
      }
    } catch {
      alert("Failed to save. Check the terminal for errors.");
    }
    setSaving(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg text-center space-y-4">
          <div className="text-4xl">&#10003;</div>
          <h1 className="text-2xl font-bold text-gray-900">Setup Complete!</h1>
          <p className="text-gray-600">
            Restart the app to apply the changes. Close this window, stop the
            terminal (Ctrl+C), and double-click <strong>start.bat</strong>{" "}
            again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-600">
              Step {step + 1} of {steps.length}
            </span>
            <span className="text-xs text-gray-400">One-time setup</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900">{current.title}</h2>

        <ol className="space-y-2">
          {current.instructions.map((inst, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="font-medium text-indigo-600 shrink-0">
                {i + 1}.
              </span>
              {inst}
            </li>
          ))}
        </ol>

        {current.copyValue && (
          <div className="flex items-center gap-2 rounded-md bg-gray-50 border border-gray-200 p-3">
            <code className="text-sm text-gray-800 flex-1 break-all">
              {current.copyValue}
            </code>
            <button
              onClick={() => copyToClipboard(current.copyValue!)}
              className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        {current.afterInstructions && (
          <ol className="space-y-2" start={current.instructions.length + 1}>
            {current.afterInstructions.map((inst, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="font-medium text-indigo-600 shrink-0">
                  {current.instructions.length + i + 1}.
                </span>
                {inst}
              </li>
            ))}
          </ol>
        )}

        {current.link && (
          <a
            href={current.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            {current.linkText} &#8599;
          </a>
        )}

        {current.hasForm && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="something.apps.googleusercontent.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !clientId.trim() || !clientSecret.trim()}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save & Finish"}
            </button>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            Back
          </button>
          {!current.hasForm && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === steps.length - 1}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
