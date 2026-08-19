"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { countries, countryCodes } from "@/lib/countries";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", username: "", email: "", password: "",
    confirmPassword: "", phoneCode: "+91", phone: "", city: "", country: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.username || !form.email || !form.password) {
      setError("Name, username, email and password are required");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/register", {
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
        phone: form.phoneCode + " " + form.phone,
        city: form.city,
        country: form.country,
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      router.push("/student/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed");
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 my-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Create Account</h1>
        <p className="text-center text-gray-500 mb-6">Fill in your details to register</p>

        {error && <div className="bg-red-100 text-red-700 text-sm rounded-lg p-3 mb-4 font-medium border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Your Name *</label>
            <input name="name" type="text" value={form.name} onChange={handleChange} required
              className={inputClass} placeholder="Enter your full name" />
          </div>

          <div>
            <label className={labelClass}>Username *</label>
            <input name="username" type="text" value={form.username} onChange={handleChange} required
              className={inputClass} placeholder="Choose a username" />
          </div>

          <div>
            <label className={labelClass}>Your Email *</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required
              className={inputClass} placeholder="you@example.com" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Password *</label>
              <div className="relative">
                <input name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={handleChange} required
                  className={inputClass} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
                  </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Confirm Password *</label>
              <div className="relative">
                <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={handleChange} required
                  className={inputClass} placeholder="••••••••" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
                  </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <div className="flex gap-2">
              <select name="phoneCode" value={form.phoneCode} onChange={handleChange}
                className="w-32 px-2 py-2.5 border-2 border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                {countryCodes.map((cc) => <option key={cc.code} value={cc.code}>{cc.code}</option>)}
              </select>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                className={inputClass} placeholder="234 567 890" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>City</label>
              <input name="city" type="text" value={form.city} onChange={handleChange}
                className={inputClass} placeholder="Your city" />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <select name="country" value={form.country} onChange={handleChange}
                className={inputClass}>
                <option value="">Select Country</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={() => router.push("/")}
            className="text-sm text-blue-600 hover:underline font-medium">
            Have an Account? Login
          </button>
        </div>
      </div>
    </div>
  );
}
