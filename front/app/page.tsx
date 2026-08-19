"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"admin" | "student">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/login", { email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      if (res.data.user.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/student/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">GRE Prep</h1>
        <p className="text-center text-gray-500 mb-6">Sign in to continue</p>

        <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setTab("admin"); setError(""); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === "admin" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
          >
            Admin
          </button>
          <button
            onClick={() => { setTab("student"); setError(""); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === "student" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
          >
            Student
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : tab === "admin" ? "Admin Login" : "Student Login"}
          </button>
        </form>

        {tab === "student" && (
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push("/register")}
              className="text-sm text-blue-600 hover:underline"
            >
              New student? Create Account
            </button>
          </div>
        )}

        {tab === "admin" && (
          <p className="mt-4 text-center text-xs text-gray-400">
            Default: admin@gre.com / admin123
          </p>
        )}
      </div>
    </div>
  );
}
