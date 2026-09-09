"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

const DEPARTMENTS = [
  "Computer Science",
  "Petroleum Engineering",
  "Chemical Engineering",
  "Mechanical Engineering",
  "Electrical/Electronics Engineering",
  "Environmental Management",
  "Marine Engineering",
  "Mathematics",
];

const FACULTIES = ["Science", "Engineering", "Environmental Sciences"];
const LEVELS = ["400 Level", "500 Level"];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    matricNumber: "",
    department: DEPARTMENTS[0],
    faculty: FACULTIES[0],
    level: LEVELS[0],
    sessionOfGraduation: "2024/2025",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Checked here because the API has no notion of a confirmation field.
    if (form.password !== form.confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, phone: payload.phone || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        // The API returns a zod tree under `details`; surface the first concrete
        // message rather than the generic "Validation failed".
        const details = data.details as
          | Record<string, { _errors?: string[] } | undefined>
          | undefined;
        const firstFieldError = details
          ? Object.values(details)
              .flatMap((v) => v?._errors ?? [])
              .find(Boolean)
          : undefined;
        throw new Error(firstFieldError || data.error || "Registration failed");
      }

      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "block w-full px-4 py-2.5 border border-[#CCCCCC] rounded-md bg-white text-[#292D32] placeholder-[#718096] focus:outline-none focus:ring-2 focus:ring-[#3482B9] focus:border-transparent transition-all text-sm font-medium";
  const labelClass =
    "block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5 font-poppins";

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#D2D7DF] py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#3482B9] selection:text-white relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-[#EAABF0]/10 blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-[#3482B9]/10 blur-[150px]"></div>
      </div>

      <div className="w-full max-w-2xl z-10">
        <div className="bg-white rounded-2xl shadow-[0px_15px_40px_rgba(15,32,66,0.15)] border border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-[#DCE1E7] px-6 py-5 border-b border-slate-300/60 flex items-center gap-4">
            <img
              src="/fupre_logo.png"
              alt="FUPRE Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0"
            />
            <div className="text-left font-poppins">
              <h1 className="font-bold text-slate-800 text-xs sm:text-[13px] leading-tight tracking-tight uppercase">
                Federal University of
              </h1>
              <h1 className="font-bold text-slate-800 text-xs sm:text-[13px] leading-tight tracking-tight uppercase">
                Petroleum Resources, Effurun
              </h1>
              <span className="block font-bold text-red-800 text-[8px] sm:text-[9px] tracking-wider uppercase mt-1">
                Excellence and Relevance
              </span>
            </div>
          </div>

          {registered ? (
            <div className="p-8 sm:p-10 flex flex-col items-center text-center font-poppins">
              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">
                Registration successful
              </h2>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
                Your clearance record has been created and every clearing unit has been
                initialised for you. Sign in to begin your clearance.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl text-sm font-semibold text-white bg-[#3482B9] hover:bg-[#2a6996] shadow-md shadow-[#3482B9]/20 transition-all cursor-pointer"
              >
                Continue to Login
              </button>
            </div>
          ) : (
            <div className="p-6 sm:p-8 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-[#5D5A5A] mb-1 font-poppins">
                Student Registration
              </h2>
              <p className="text-xs text-slate-500 mb-6 font-poppins">
                Register with your institutional email to begin graduation clearance.
              </p>

              {error && (
                <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-semibold">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Full Name</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      className={inputClass}
                      placeholder="Oghenekome Peter"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Matriculation Number</label>
                    <input
                      type="text"
                      required
                      value={form.matricNumber}
                      onChange={(e) => update("matricNumber", e.target.value)}
                      className={inputClass}
                      placeholder="CSC/2021/002"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Institutional Email</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className={inputClass}
                      placeholder="name@fupre.edu.ng"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phone Number (optional)</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className={inputClass}
                      placeholder="+234..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      className={inputClass}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm Password</label>
                    <input
                      type="password"
                      required
                      value={form.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      className={inputClass}
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Faculty</label>
                    <select
                      value={form.faculty}
                      onChange={(e) => update("faculty", e.target.value)}
                      className={inputClass}
                    >
                      {FACULTIES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Department</label>
                    <select
                      value={form.department}
                      onChange={(e) => update("department", e.target.value)}
                      className={inputClass}
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Level</label>
                    <select
                      value={form.level}
                      onChange={(e) => update("level", e.target.value)}
                      className={inputClass}
                    >
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Session of Graduation</label>
                    <input
                      type="text"
                      required
                      value={form.sessionOfGraduation}
                      onChange={(e) => update("sessionOfGraduation", e.target.value)}
                      className={inputClass}
                      placeholder="2024/2025"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3482B9] hover:underline cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center py-2.5 px-6 border border-transparent rounded-xl text-sm font-semibold text-white bg-[#3482B9] hover:bg-[#2a6996] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3482B9] shadow-md shadow-[#3482B9]/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-[#E6E8EA] px-6 py-4 border-t border-slate-200/80 text-center">
            <span className="text-[11px] text-slate-600 font-semibold tracking-wide font-poppins">
              For technical support email: soap@fupre.edu.ng
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
