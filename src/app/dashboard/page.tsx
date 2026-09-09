"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import StudentDashboard from "@/components/StudentDashboard";
import StaffDashboard from "@/components/StaffDashboard";
import AdminDashboard from "@/components/AdminDashboard";
import RegistrarDashboard from "@/components/RegistrarDashboard";
import { clearSession } from "@/lib/api-client";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("dscs_token");
    const storedUser = localStorage.getItem("dscs_user");

    if (!token || !storedUser) {
      // Clear storage and redirect to login if auth parameters are missing
      clearSession();
      router.push("/login");
    } else {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        clearSession();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (e) {
      console.error("Logout endpoint failure:", e);
    } finally {
      clearSession();
      router.push("/login");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#D2D7DF]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin h-10 w-10 text-[#3482B9]" />
          <span className="text-xs font-semibold text-slate-500 font-poppins">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (user?.role === "STUDENT") {
    return <StudentDashboard user={user} onLogout={handleLogout} />;
  }

  if (user?.role === "STAFF") {
    return <StaffDashboard user={user} onLogout={handleLogout} />;
  }

  // The Registrar is read-only and is not authorised for the admin-only audit
  // log endpoint, so it gets its own monitoring view rather than the admin one.
  if (user?.role === "REGISTRAR") {
    return <RegistrarDashboard user={user} onLogout={handleLogout} />;
  }

  if (user?.role === "ADMIN") {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#D2D7DF]">
      <div className="text-center font-poppins">
        <h3 className="text-lg font-bold text-red-600">Access Denied</h3>
        <p className="text-xs text-slate-500 mt-2">Your profile role is unrecognized.</p>
        <button 
          onClick={handleLogout} 
          className="mt-4 px-5 py-2.5 bg-[#3482B9] hover:bg-[#2a6996] text-white text-xs font-semibold rounded-xl shadow transition-all cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
