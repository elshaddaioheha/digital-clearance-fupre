"use client";

import { useState, useEffect } from "react";
import { apiFetch, readJson } from "@/lib/api-client";
import {
  GraduationCap,
  LogOut,
  Search,
  Download,
  Loader2,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  Eye,
  X,
} from "lucide-react";

interface ClearanceRequestSummary {
  id: string;
  status: string;
  unitId: string;
  clearingUnit: { name: string; sortOrder: number };
}

interface StudentRow {
  userId: string;
  matricNumber: string;
  department: string;
  faculty: string;
  level: string;
  sessionOfGraduation: string;
  user: { name: string; email: string; phone: string | null };
  isFullyCleared: boolean;
  clearanceRequests: ClearanceRequestSummary[];
}

interface RegistrarDashboardProps {
  user: { id: string; name: string; email: string; role: string };
  onLogout: () => void;
}

/**
 * Read-only monitoring view for the Registrar.
 *
 * The Registrar previously landed on the admin dashboard, which calls
 * admin-only endpoints and left the audit tab permanently empty. This uses only
 * what the role is actually authorised for — GET /api/admin/students — and adds
 * the export the office needs. It deliberately exposes no override controls.
 */
export default function RegistrarDashboard({ user, onLogout }: RegistrarDashboardProps) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "cleared" | "pending">("all");
  const [selected, setSelected] = useState<StudentRow | null>(null);

  const fetchStudents = async () => {
    try {
      const res = await apiFetch("/api/admin/students");
      const data = await readJson(res);
      setStudents(data?.students || []);
    } catch (e) {
      console.error("Error loading registrar monitoring data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matches =
      s.user.name.toLowerCase().includes(q) ||
      s.matricNumber.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q);

    if (filterStatus === "cleared") return matches && s.isFullyCleared;
    if (filterStatus === "pending") return matches && !s.isFullyCleared;
    return matches;
  });

  const clearedCount = students.filter((s) => s.isFullyCleared).length;
  const approvedUnits = (s: StudentRow) =>
    s.clearanceRequests.filter((r) => r.status === "APPROVED").length;

  /** Wraps a value for CSV: escape embedded quotes, quote every field. */
  const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const handleExportCsv = () => {
    // One column per clearing unit, in clearance order. Collecting names into
    // a Set alone would leave the columns in whatever order the rows happened
    // to arrive in, which reads as arbitrary next to a sequential process.
    const unitOrder = new Map<string, number>();
    for (const student of students) {
      for (const request of student.clearanceRequests) {
        unitOrder.set(request.clearingUnit.name, request.clearingUnit.sortOrder);
      }
    }

    const unitNames = Array.from(unitOrder.keys()).sort(
      (a, b) => (unitOrder.get(a) ?? 0) - (unitOrder.get(b) ?? 0)
    );

    const header = [
      "Matric Number",
      "Full Name",
      "Email",
      "Phone",
      "Faculty",
      "Department",
      "Level",
      "Session",
      "Units Approved",
      "Total Units",
      "Fully Cleared",
      ...unitNames,
    ];

    const rows = filtered.map((s) => {
      const byUnit = new Map(s.clearanceRequests.map((r) => [r.clearingUnit.name, r.status]));
      return [
        s.matricNumber,
        s.user.name,
        s.user.email,
        s.user.phone || "",
        s.faculty,
        s.department,
        s.level,
        s.sessionOfGraduation,
        approvedUnits(s),
        s.clearanceRequests.length,
        s.isFullyCleared ? "YES" : "NO",
        ...unitNames.map((n) => byUnit.get(n) || "NOT_SUBMITTED"),
      ];
    });

    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

    // BOM so Excel reads the file as UTF-8 rather than the local codepage.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FUPRE_Clearance_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#D2D7DF]">
        <Loader2 className="animate-spin h-10 w-10 text-[#3482B9]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D2D7DF] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3482B9] flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="font-poppins leading-tight">
              <span className="block text-sm font-bold text-slate-800">FUPRE Clearance</span>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Registrar Monitoring
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right font-poppins leading-tight">
              <span className="block text-xs font-semibold text-slate-700">{user.name}</span>
              <span className="block text-[10px] text-slate-400">{user.email}</span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#3482B9]/10 border border-[#3482B9]/20 text-[10px] font-bold text-[#3482B9] tracking-wider">
              <ShieldCheck className="w-3 h-3" /> READ-ONLY
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Stat tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Graduating Students", value: students.length, Icon: Users, tint: "text-[#3482B9]", bg: "bg-[#3482B9]/10" },
            { label: "Fully Cleared", value: clearedCount, Icon: CheckCircle2, tint: "text-green-600", bg: "bg-green-50" },
            { label: "Clearance In Progress", value: students.length - clearedCount, Icon: Clock, tint: "text-amber-600", bg: "bg-amber-50" },
          ].map(({ label, value, Icon, tint, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${tint}`} />
              </div>
              <div className="font-poppins">
                <span className="block text-2xl font-bold text-slate-800 leading-none">{value}</span>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-1">
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-poppins">
              <h2 className="text-sm font-bold text-slate-800">Clearance Monitoring</h2>
              <span className="text-[11px] text-slate-400">
                Showing {filtered.length} of {students.length} students
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, matric or department"
                  className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#3482B9] transition-all"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3482B9] transition-all cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="cleared">Fully cleared</option>
                <option value="pending">In progress</option>
              </select>

              <button
                onClick={handleExportCsv}
                disabled={filtered.length === 0}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#3482B9] hover:bg-[#2a6996] text-white text-xs font-semibold shadow-md shadow-[#3482B9]/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-poppins min-w-[820px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 text-left font-bold">Matric Number</th>
                  <th className="py-3 px-4 text-left font-bold">Student</th>
                  <th className="py-3 px-4 text-left font-bold">Department</th>
                  <th className="py-3 px-4 text-left font-bold">Session</th>
                  <th className="py-3 px-4 text-center font-bold">Progress</th>
                  <th className="py-3 px-4 text-center font-bold">Status</th>
                  <th className="py-3 px-4 text-center font-bold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map((s) => {
                    const approved = approvedUnits(s);
                    const total = s.clearanceRequests.length || 1;
                    const pct = Math.round((approved / total) * 100);

                    return (
                      <tr key={s.userId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {s.matricNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="block font-semibold text-slate-800">{s.user.name}</span>
                          <span className="block text-[10px] text-slate-400">{s.user.email}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{s.department}</td>
                        <td className="py-3.5 px-4 text-slate-500">{s.sessionOfGraduation}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${s.isFullyCleared ? "bg-green-500" : "bg-[#3482B9]"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 w-10 text-right">
                              {approved}/{s.clearanceRequests.length}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block border rounded-md px-2.5 py-1 text-[10px] font-semibold w-24 ${
                              s.isFullyCleared
                                ? "bg-green-50 border-green-300 text-green-700"
                                : "bg-amber-50 border-amber-300 text-amber-700"
                            }`}
                          >
                            {s.isFullyCleared ? "Cleared" : "In Progress"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelected(s)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3482B9] hover:underline cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                      No students match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Per-student unit breakdown */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="font-poppins">
                <h3 className="text-sm font-bold text-slate-800">{selected.user.name}</h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selected.matricNumber} · {selected.department}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <ul className="space-y-2 font-poppins">
                {selected.clearanceRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/60"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {r.clearingUnit.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        r.status === "APPROVED"
                          ? "bg-green-50 border-green-300 text-green-700"
                          : r.status === "REJECTED"
                          ? "bg-red-50 border-red-300 text-red-700"
                          : r.status === "NOT_SUBMITTED"
                          ? "bg-slate-100 border-slate-300 text-slate-500"
                          : "bg-amber-50 border-amber-300 text-amber-700"
                      }`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 text-center">
              <span className="text-[10px] text-slate-400 font-poppins font-semibold uppercase tracking-wider">
                Read-only view · no override controls
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
