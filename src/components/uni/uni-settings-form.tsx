"use client";

import { useState } from "react";
import { saveUniSettings } from "@/lib/actions/uni/settings";
import { UniPluginToggle } from "./uni-plugin-toggle";
import { SemesterModal } from "./semester-modal";

interface UniSettingsFormProps {
  initialSettings: any;
  semesters?: any[];
}

export function UniSettingsForm({ initialSettings, semesters: initialSemesters }: UniSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings || {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleToggle = (enabled: boolean) => {
    setSettings({ ...settings, enabled });
    setMessage(enabled ? "University tracker enabled" : "University tracker disabled");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(settings).forEach(([key, value]) => {
        if (key !== "id" && key !== "userId" && key !== "createdAt" && key !== "updatedAt" && key !== "enabled") {
          formData.append(key, String(value || ""));
        }
      });
      await saveUniSettings(formData);
      setMessage("Settings saved successfully");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/uni/settings");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uni-tracker-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {} finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plugin Toggle */}
      <UniPluginToggle initialEnabled={settings?.enabled || false} onToggle={handleToggle} />

      {settings?.enabled && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Settings */}
          <div className="p-6 bg-[#1e1e30] rounded-lg border border-[#2a2a3c] space-y-4">
            <h3 className="text-lg font-semibold text-white">User Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">University Name</label>
                <input
                  type="text"
                  name="universityName"
                  value={settings?.universityName || ""}
                  onChange={handleInputChange}
                  placeholder="University of Example"
                  className="w-full px-4 py-2 bg-[#12121c] border border-[#2a2a3c] text-white rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Student Name</label>
                <input
                  type="text"
                  name="studentName"
                  value={settings?.studentName || ""}
                  onChange={handleInputChange}
                  placeholder="Your name"
                  className="w-full px-4 py-2 bg-[#12121c] border border-[#2a2a3c] text-white rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target GPA</label>
                <input
                  type="number"
                  name="targetGPA"
                  value={settings?.targetGPA || ""}
                  onChange={handleInputChange}
                  placeholder="3.8"
                  step="0.01"
                  min="0"
                  max="4.3"
                  className="w-full px-4 py-2 bg-[#12121c] border border-[#2a2a3c] text-white rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Grade Scale</label>
                <select
                  name="gradeScale"
                  value={settings?.gradeScale || "4.0"}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-[#12121c] border border-[#2a2a3c] text-white rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                >
                  <option value="4.0">4.0 Scale (Standard US)</option>
                  <option value="4.3">4.3 Scale (A+ = 4.3)</option>
                  <option value="percentage">Percentage</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grade Scale Config (shown when custom is selected) */}
          {settings?.gradeScale === "custom" && (
            <div className="p-6 bg-[#1e1e30] rounded-lg border border-[#2a2a3c] space-y-4">
              <h3 className="text-lg font-semibold text-white">Custom Grade Scale</h3>
              <p className="text-sm text-gray-400">
                Define your custom grade scale as JSON. Format: array of objects with &quot;min&quot; (percentage), &quot;gpa&quot;, and &quot;letter&quot; fields.
              </p>
              <textarea
                name="customScaleJson"
                value={settings?.customScaleJson || '[\n  {"min": 90, "gpa": 4.0, "letter": "A"},\n  {"min": 80, "gpa": 3.0, "letter": "B"},\n  {"min": 70, "gpa": 2.0, "letter": "C"},\n  {"min": 60, "gpa": 1.0, "letter": "D"},\n  {"min": 0, "gpa": 0, "letter": "F"}\n]'}
                onChange={handleInputChange}
                rows={8}
                className="w-full px-4 py-2 bg-[#12121c] border border-[#2a2a3c] text-white rounded-lg focus:outline-none focus:border-blue-600 text-sm font-mono resize-none"
              />
            </div>
          )}

          {/* Semester Management */}
          <div className="p-6 bg-[#1e1e30] rounded-lg border border-[#2a2a3c] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Semesters</h3>
              <button
                type="button"
                onClick={() => setShowSemesterModal(true)}
                className="px-3 py-1.5 text-sm border border-[#2a2a3c] text-gray-300 hover:bg-[#2a2a3c] rounded-lg"
              >
                Manage Semesters
              </button>
            </div>
            <p className="text-sm text-gray-400">
              Manage your semesters to organize courses, exams, and grades by academic period.
            </p>
          </div>

          {/* Moodle Integration */}
          <div className="p-6 bg-[#1e1e30] rounded-lg border border-[#2a2a3c] space-y-4">
            <h3 className="text-lg font-semibold text-white">Moodle Integration</h3>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Moodle URL</label>
              <input
                type="url"
                name="moodleUrl"
                value={settings?.moodleUrl || ""}
                onChange={handleInputChange}
                placeholder="https://moodle.example.com"
                className="w-full px-4 py-2 bg-[#12121c] border border-[#2a2a3c] text-white rounded-lg focus:outline-none focus:border-blue-600 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Moodle API Token</label>
              <input
                type="password"
                name="moodleToken"
                value={settings?.moodleToken || ""}
                onChange={handleInputChange}
                placeholder="Your Moodle API token"
                className="w-full px-4 py-2 bg-[#12121c] border border-[#2a2a3c] text-white rounded-lg focus:outline-none focus:border-blue-600 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Generate in Moodle: Preferences &gt; Security keys &gt; Web service tokens
              </p>
            </div>
          </div>

          {/* Data Management */}
          <div className="p-6 bg-[#1e1e30] rounded-lg border border-[#2a2a3c] space-y-4">
            <h3 className="text-lg font-semibold text-white">Data Management</h3>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={exportLoading}
                className="px-4 py-2 text-sm border border-[#2a2a3c] text-gray-300 hover:bg-[#2a2a3c] rounded-lg disabled:opacity-50"
              >
                {exportLoading ? "Exporting..." : "Export Data (JSON)"}
              </button>
            </div>
          </div>

          {/* Save and Message */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {message && (
              <span className="text-sm text-green-400">{message}</span>
            )}
          </div>
        </form>
      )}

      {!settings?.enabled && message && (
        <p className="text-sm text-gray-400">{message}</p>
      )}

      {showSemesterModal && (
        <SemesterModal
          isOpen={showSemesterModal}
          semesters={initialSemesters || []}
          onClose={() => setShowSemesterModal(false)}
          onSaved={() => setShowSemesterModal(false)}
        />
      )}
    </div>
  );
}