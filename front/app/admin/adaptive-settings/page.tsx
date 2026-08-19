"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

interface AdaptiveSettings {
  adaptive_enabled: boolean;
  routing_model: string;
  verbal_easy_max: number;
  verbal_medium_max: number;
  quant_easy_max: number;
  quant_medium_max: number;
  section1_count: number;
  section2_count: number;
  module_lower_label: string;
  module_medium_label: string;
  module_higher_label: string;
}

export default function AdaptiveSettingsPage() {
  const [settings, setSettings] = useState<AdaptiveSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get("/admin/adaptive-settings");
      setSettings(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.put("/admin/adaptive-settings", settings);
      toast.success("Adaptive settings updated successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof AdaptiveSettings, value: any) => {
    setSettings({ ...settings!, [field]: value });
  };

  if (loading) {
    return <div className="p-8 text-gray-400">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="p-8 text-gray-400">Failed to load settings</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Adaptive Test Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          GRE-style Section-Level Adaptive Testing (MST-inspired) — Full-Length GRE only
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> This is a practice-platform routing model, not the official ETS algorithm.
          ETS uses a proprietary Multistage Adaptive Testing (MST) approach. These thresholds control
          how Section 2 difficulty is selected based on Section 1 performance.
        </p>
      </div>

      {/* Adaptive Enable/Disable */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">General</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Adaptive Routing Enabled</label>
              <p className="text-xs text-gray-500 mt-1">When disabled, Section 2 defaults to Medium difficulty</p>
            </div>
            <button
              onClick={() => update("adaptive_enabled", !settings.adaptive_enabled)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                settings.adaptive_enabled ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  settings.adaptive_enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Routing Model Name</label>
            <input
              type="text"
              value={settings.routing_model}
              onChange={(e) => update("routing_model", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Section Counts */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Section Question Counts</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Section 1 Count</label>
            <input
              type="number"
              value={settings.section1_count}
              onChange={(e) => update("section1_count", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Default: 12 questions</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Section 2 Count</label>
            <input
              type="number"
              value={settings.section2_count}
              onChange={(e) => update("section2_count", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Default: 15 questions</p>
          </div>
        </div>
      </div>

      {/* Verbal Thresholds */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Verbal Routing Thresholds</h2>
        <p className="text-xs text-gray-500 mb-4">
          Based on correct answers in Verbal Section 1 (out of {settings.section1_count})
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Easy (Lower) Max Score</label>
            <input
              type="number"
              value={settings.verbal_easy_max}
              onChange={(e) => update("verbal_easy_max", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">0 to this score → {settings.module_lower_label}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Medium Max Score</label>
            <input
              type="number"
              value={settings.verbal_medium_max}
              onChange={(e) => update("verbal_medium_max", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Above easy max to this → {settings.module_medium_label}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Above {settings.verbal_medium_max} → {settings.module_higher_label}
        </p>
      </div>

      {/* Quant Thresholds */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quant Routing Thresholds</h2>
        <p className="text-xs text-gray-500 mb-4">
          Based on correct answers in Quant Section 1 (out of {settings.section1_count})
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Easy (Lower) Max Score</label>
            <input
              type="number"
              value={settings.quant_easy_max}
              onChange={(e) => update("quant_easy_max", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">0 to this score → {settings.module_lower_label}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Medium Max Score</label>
            <input
              type="number"
              value={settings.quant_medium_max}
              onChange={(e) => update("quant_medium_max", parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Above easy max to this → {settings.module_medium_label}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Above {settings.quant_medium_max} → {settings.module_higher_label}
        </p>
      </div>

      {/* Module Labels */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Module Labels</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Lower-level Module Label</label>
            <input
              type="text"
              value={settings.module_lower_label}
              onChange={(e) => update("module_lower_label", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Medium-level Module Label</label>
            <input
              type="text"
              value={settings.module_medium_label}
              onChange={(e) => update("module_medium_label", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Higher-level Module Label</label>
            <input
              type="text"
              value={settings.module_higher_label}
              onChange={(e) => update("module_higher_label", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
