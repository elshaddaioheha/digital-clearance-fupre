"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Store the stateless access token in localStorage for client-side API requests
      localStorage.setItem("dscs_token", data.accessToken);
      localStorage.setItem("dscs_user", JSON.stringify(data.user));

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to auto-login with seeded credentials
  const handleQuickLogin = (emailVal: string, passwordVal: string) => {
    setEmail(emailVal);
    setPassword(passwordVal);
    setError("");
    // Autofill and submit after state update
    setTimeout(() => {
      const form = document.getElementById("login-form") as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }, 100);
  };

  const quickProfiles = [
    { label: "Graduating Student", email: "student@fupre.edu.ng", pass: "studentpassword", role: "STUDENT" },
    { label: "Library Staff", email: "library_staff@fupre.edu.ng", pass: "librarypassword", role: "STAFF" },
    { label: "Bursary Staff", email: "bursary_staff@fupre.edu.ng", pass: "bursarypassword", role: "STAFF" },
    { label: "Academic Registrar", email: "registrar@fupre.edu.ng", pass: "registrarpassword", role: "REGISTRAR" },
    { label: "System Administrator", email: "admin@fupre.edu.ng", pass: "adminpassword", role: "ADMIN" },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#D2D7DF] py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#3482B9] selection:text-white relative">
      
      {/* Subtle Background meshes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-[#EAABF0]/10 blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-[#3482B9]/10 blur-[150px]"></div>
      </div>

      <div className="w-full max-w-md z-10">
        
        {/* Main Login Card */}
        <div className="bg-white rounded-2xl shadow-[0px_15px_40px_rgba(15,32,66,0.15)] border border-slate-200 overflow-hidden flex flex-col">
          
          {/* Card Header (Mimicking FUPRE Header) */}
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

          {/* Card Body */}
          <div className="p-6 sm:p-8 flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-[#5D5A5A] mb-6 font-poppins">
              Student Login
            </h2>

            {error && (
              <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-semibold transition-all">
                {error}
              </div>
            )}

            <form id="login-form" onSubmit={handleLogin} className="space-y-5">
              
              {/* Matric/Email Input */}
              <div>
                <div className="relative rounded-lg">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pr-10 pl-4 py-3 border border-[#CCCCCC] rounded-md bg-white text-[#292D32] placeholder-[#718096] focus:outline-none focus:ring-2 focus:ring-[#3482B9] focus:border-transparent transition-all text-sm font-medium"
                    placeholder="Matric/Registration Number"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-[#718096]" />
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="relative rounded-lg">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pr-10 pl-4 py-3 border border-[#CCCCCC] rounded-md bg-white text-[#292D32] placeholder-[#718096] focus:outline-none focus:ring-2 focus:ring-[#3482B9] focus:border-transparent transition-all text-sm font-medium"
                    placeholder="Password"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-[#718096]" />
                  </div>
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex items-center justify-between pt-1">
                <a 
                  href="#" 
                  className="text-xs font-semibold text-[#3482B9] hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Please contact the ICT unit at soap@fupre.edu.ng to reset your password.");
                  }}
                >
                  Forgot password?
                </a>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center py-2.5 px-6 border border-transparent rounded-xl text-sm font-semibold text-white bg-[#3482B9] hover:bg-[#2a6996] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3482B9] shadow-md shadow-[#3482B9]/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    "Log In"
                  )}
                </button>
              </div>

            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-500 font-poppins">
                New graduating student?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="font-semibold text-[#3482B9] hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </span>
            </div>
          </div>

          {/* Card Footer */}
          <div className="bg-[#E6E8EA] px-6 py-4 border-t border-slate-200/80 text-center">
            <span className="text-[11px] text-slate-600 font-semibold tracking-wide font-poppins">
              For technical support email: soap@fupre.edu.ng
            </span>
          </div>

        </div>

        {/* Demo Access Shortcuts */}
        <div className="mt-8 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <span className="block text-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 font-poppins">
            Demo Access Shortcuts
          </span>
          <div className="flex flex-col gap-2">
            {quickProfiles.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleQuickLogin(p.email, p.pass)}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white hover:bg-slate-50 hover:border-[#3482B9]/60 transition-all text-left text-xs cursor-pointer group"
              >
                <div>
                  <span className="font-semibold text-slate-800">{p.label}</span>
                  <span className="block text-[10px] text-slate-400">{p.email}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 group-hover:border-[#3482B9]/40 group-hover:text-[#3482B9] transition-all text-[10px] font-bold tracking-wider text-slate-500">
                  {p.role}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
