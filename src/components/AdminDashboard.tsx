"use client";

import { useState, useEffect } from "react";
import { 
  GraduationCap, 
  LayoutDashboard, 
  Users, 
  FolderLock, 
  ShieldCheck, 
  HelpCircle, 
  LogOut, 
  Search, 
  ChevronDown, 
  Activity, 
  UserCheck, 
  AlertCircle, 
  Eye, 
  Settings, 
  History,
  X,
  Menu,
  Smile,
  Check,
  AlertTriangle,
  Loader2,
  ArrowRight
} from "lucide-react";

interface Student {
  userId: string;
  matricNumber: string;
  department: string;
  faculty: string;
  level: string;
  sessionOfGraduation: string;
  user: {
    name: string;
    email: string;
    phone: string | null;
  };
  clearanceRequests: Array<{
    id: string;
    status: string;
    unitId: string;
    clearingUnit: {
      name: string;
    };
  }>;
}

interface AuditLog {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: any;
  timestamp: string;
  actor?: {
    email: string;
    name: string;
  };
}

interface AdminDashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"students" | "audit">("students");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [overrideRequest, setOverrideRequest] = useState<any | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("dscs_token") : null;

  const fetchAdminData = async () => {
    try {
      const studentRes = await fetch("/api/admin/students", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const studentData = await studentRes.json();
      setStudents(studentData.students || []);

      const logsRes = await fetch("/api/admin/audit-logs", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const logsData = await logsRes.json();
      setAuditLogs(logsData.auditLogs || []);
    } catch (e) {
      console.error("Error fetching admin dashboard records:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
  }, [token]);

  const handleOverrideSubmit = async (e: React.FormEvent, forceStatus: "APPROVED" | "REJECTED") => {
    e.preventDefault();
    if (!overrideRequest || !overrideNote.trim()) return;

    setOverrideLoading(true);
    try {
      const res = await fetch(`/api/admin/clearance/${overrideRequest.id}/override`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status: forceStatus, 
          justification: overrideNote 
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Override request failed");
      }

      setOverrideRequest(null);
      setOverrideNote("");
      
      await fetchAdminData();
      
      if (selectedStudent) {
        const updatedStud = students.find(s => s.userId === selectedStudent.userId);
        if (updatedStud) {
          setSelectedStudent(updatedStud);
        }
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setOverrideLoading(false);
    }
  };

  // Stats calculation
  const totalStudentsCount = students.length;
  const fullyClearedCount = students.filter(s => 
    s.clearanceRequests.length > 0 && s.clearanceRequests.every(r => r.status === "APPROVED")
  ).length;
  const pendingStudentsCount = totalStudentsCount - fullyClearedCount;

  // Filter & Search student database
  const filteredStudents = students.filter(s => {
    const nameMatch = s.user.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matricMatch = s.matricNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const deptMatch = s.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || matricMatch || deptMatch;

    const allApproved = s.clearanceRequests.length > 0 && s.clearanceRequests.every(r => r.status === "APPROVED");
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "cleared") return matchesSearch && allApproved;
    if (filterStatus === "pending") return matchesSearch && !allApproved;
    return matchesSearch;
  });

  const getOverallStatusStyle = (student: Student) => {
    const reqs = student.clearanceRequests;
    if (reqs.length === 0) return { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", label: "Uninitialized" };
    
    const allApproved = reqs.every(r => r.status === "APPROVED");
    if (allApproved) {
      return { 
        bg: "bg-green-50", 
        border: "border-green-300", 
        text: "text-green-700", 
        label: "Fully Cleared" 
      };
    }

    const hasRejections = reqs.some(r => r.status === "REJECTED");
    if (hasRejections) {
      return { 
        bg: "bg-red-50", 
        border: "border-red-300", 
        text: "text-red-700", 
        label: "Attention Needed" 
      };
    }

    return { 
      bg: "bg-amber-50", 
      border: "border-amber-300", 
      text: "text-amber-700", 
      label: "Pending Review" 
    };
  };

  const getUnitStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "text-green-650 bg-green-50 border-green-200";
      case "REJECTED": return "text-red-650 bg-red-50 border-red-200";
      case "PENDING_REVIEW":
      case "UNDER_REVIEW": return "text-amber-650 bg-amber-50 border-amber-200";
      default: return "text-zinc-500 bg-zinc-50 border-zinc-200";
    }
  };

  const handleScrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#D2D7DF]">
        <Loader2 className="animate-spin h-10 w-10 text-[#3482B9]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D2D7DF] relative flex flex-col overflow-x-hidden selection:bg-[#3482B9] selection:text-white">
      
      {/* 1. Dual-Tier Header */}
      <header className="fixed top-0 left-0 w-full z-30 shadow-md">
        {/* Tier 1: White logo header banner */}
        <div className="bg-white h-16 px-4 sm:px-6 flex items-center justify-center sm:justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img 
              src="/fupre_logo.png" 
              alt="FUPRE Logo" 
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="text-left font-poppins">
              <h1 className="font-bold text-slate-800 text-[10px] sm:text-xs leading-tight tracking-tight uppercase">
                Federal University of
              </h1>
              <h1 className="font-bold text-slate-800 text-[10px] sm:text-xs leading-tight tracking-tight uppercase">
                Petroleum Resources, Effurun
              </h1>
              <span className="block font-bold text-red-800 text-[8px] sm:text-[9px] tracking-wider uppercase mt-0.5">
                Excellence and Relevance
              </span>
            </div>
          </div>
          <div className="hidden sm:block text-slate-400 font-poppins text-xs font-bold uppercase tracking-wider">
            Admin Portal
          </div>
        </div>

        {/* Tier 2: Blue Navigation Bar */}
        <div className="bg-[#3482B9] h-12 px-4 sm:px-6 flex items-center justify-between text-white shadow-inner">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs font-semibold">{user.name}</span>
              <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-slate-200 flex items-center justify-center font-bold text-slate-800 text-xs uppercase cursor-pointer" onClick={() => setMobileMenuOpen(true)}>
                {user.name.charAt(0)}
              </div>
            </div>
            <button 
              className="p-1.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-Drawer Side Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          ></div>
          
          <aside className="relative w-72 max-w-xs bg-white h-full flex flex-col justify-between py-6 px-5 border-r shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <img 
                    src="/fupre_logo.png" 
                    alt="FUPRE Logo" 
                    className="w-8 h-8 object-contain"
                  />
                  <span className="font-poppins font-bold text-xs text-slate-900">FUPRE DSCS</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <nav className="space-y-3">
                <button 
                  onClick={() => { setActiveTab("students"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all font-poppins font-medium text-xs text-left cursor-pointer ${
                    activeTab === "students" 
                      ? "bg-[#3482B9] text-white" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4" />
                    <span>Graduating Students</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => { setActiveTab("audit"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all font-poppins font-medium text-xs text-left cursor-pointer ${
                    activeTab === "audit" 
                      ? "bg-[#3482B9] text-white" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <History className="w-4 h-4" />
                    <span>Audit Logs</span>
                  </div>
                </button>

                <button 
                  onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-red-500 hover:bg-red-50 rounded-lg font-poppins font-medium text-xs text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sign Out</span>
                </button>
              </nav>
            </div>

            <div className="flex items-center pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#3482B9] flex items-center justify-center font-bold text-white uppercase text-xs">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <span className="block font-poppins font-semibold text-xs text-slate-800 max-w-[140px] truncate" title={user.name}>
                    {user.name}
                  </span>
                  <span className="block text-[8px] text-slate-400 font-poppins capitalize">
                    {user.role.toLowerCase()}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 2. Main Content Grid */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-12 flex flex-col gap-6 z-10">
        
        {/* Title & Breadcrumb Block */}
        <div className="flex flex-col gap-2 mt-2">
          <h1 className="font-poppins font-bold text-xl sm:text-2xl text-slate-800">
            <span className="block text-[10px] sm:text-xs text-[#3482B9] uppercase tracking-wider mb-1">DSCS Admin Portal</span>
            {activeTab === "students" ? "Graduating Students Directory" : "System Audit Logs"}
          </h1>
          
          <div className="bg-[#E2E8F0] px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-2 border border-slate-300/40">
            <LayoutDashboard className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Home</span>
            <span className="text-slate-400 font-normal">&gt;</span>
            <span className="text-slate-500 font-normal">{activeTab === "students" ? "Students" : "Audit Logs"}</span>
          </div>
        </div>

        {/* Portal Statistics widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 font-poppins mb-2">
          {/* Card 1: Registered Students (Green) */}
          <div className="bg-[#00A65A] text-white rounded-xl shadow-md overflow-hidden flex flex-col justify-between min-h-[140px] transform hover:scale-[1.01] transition-transform">
            <div className="p-4 sm:p-6">
              <span className="block font-bold text-4xl sm:text-5xl mb-1">{totalStudentsCount}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Registered Profiles</span>
            </div>
            <div 
              className="bg-black/10 py-2.5 px-4 text-center text-[10px] sm:text-xs font-semibold text-white/95 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/20 transition-colors" 
              onClick={() => handleScrollToSection("main-view")}
            >
              <span>More info</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: Fully Cleared (Orange) */}
          <div className="bg-[#F39C12] text-white rounded-xl shadow-md overflow-hidden flex flex-col justify-between min-h-[140px] transform hover:scale-[1.01] transition-transform">
            <div className="p-4 sm:p-6">
              <span className="block font-bold text-4xl sm:text-5xl mb-1">{fullyClearedCount}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Fully Cleared</span>
            </div>
            <div 
              className="bg-black/10 py-2.5 px-4 text-center text-[10px] sm:text-xs font-semibold text-white/95 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/20 transition-colors" 
              onClick={() => handleScrollToSection("main-view")}
            >
              <span>More info</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Uncleared Status (Red style) */}
          <div className="bg-[#DD4B39] text-white rounded-xl shadow-md overflow-hidden flex flex-col justify-between min-h-[140px] transform hover:scale-[1.01] transition-transform">
            <div className="p-4 sm:p-6">
              <span className="block font-bold text-4xl sm:text-5xl mb-1">{pendingStudentsCount}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Reviews Pending</span>
            </div>
            <div 
              className="bg-black/10 py-2.5 px-4 text-center text-[10px] sm:text-xs font-semibold text-white/95 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/20 transition-colors" 
              onClick={() => handleScrollToSection("main-view")}
            >
              <span>More info</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* 5. Responsive Main Content Area (Directory + Profile card) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main List Box (8 columns on lg) */}
          <div id="main-view" className="lg:col-span-8 bg-white py-6 px-4 sm:px-6 rounded-2xl shadow-md border border-slate-200 flex flex-col justify-between min-h-[500px]">
            
            {activeTab === "students" ? (
              /* Students List */
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 px-2">
                  <div>
                    <h3 className="font-poppins font-semibold text-xl text-slate-800">
                      Graduating Students
                    </h3>
                    <span className="text-xs text-[#00A65A] font-poppins font-semibold">
                      Student Database
                    </span>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-56">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Student name or Matric"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-[#292D32] focus:outline-none focus:ring-2 focus:ring-[#3482B9] transition-all font-poppins"
                      />
                    </div>

                    <div className="relative w-full sm:w-auto">
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3482B9] transition-all font-poppins cursor-pointer"
                      >
                        <option value="all">Sort by : All</option>
                        <option value="cleared">Fully Cleared</option>
                        <option value="pending">Review Pending</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Scrollable Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-400 font-poppins">
                        <th className="py-3 px-4">Graduating Student</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Faculty</th>
                        <th className="py-3 px-4 text-center">Clearance Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-poppins text-xs font-medium text-[#292D32]">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((stud) => {
                          const style = getOverallStatusStyle(stud);
                          return (
                            <tr key={stud.userId} className="hover:bg-slate-50/55 transition-all">
                              <td className="py-4 px-4">
                                <span className="block font-semibold text-sm text-slate-800">
                                  {stud.user.name}
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                  {stud.matricNumber} / {stud.user.email}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-slate-500">
                                {stud.department}
                              </td>
                              <td className="py-4 px-4 text-slate-500">
                                {stud.faculty}
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={`inline-block border rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.border} ${style.text} w-32 text-center`}>
                                  {style.label}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => setSelectedStudent(stud)}
                                  className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-white bg-[#3482B9] hover:bg-[#2a6996] rounded-xl px-3.5 py-2 transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View Progress
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 px-4 text-center text-slate-400">
                            No students found matching search filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 px-2 font-poppins text-xs font-semibold">
                  <span className="text-slate-400">
                    Showing {filteredStudents.length} of {students.length} entries
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center justify-center w-6 h-6 border border-slate-200 bg-slate-50 rounded text-slate-500 disabled:opacity-50" disabled>
                      &lt;
                    </button>
                    <button className="flex items-center justify-center w-6 h-6 border border-[#3482B9] bg-[#3482B9] rounded text-white font-bold">
                      1
                    </button>
                    <button className="flex items-center justify-center w-6 h-6 border border-slate-200 bg-slate-50 rounded text-slate-500 disabled:opacity-50" disabled>
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Audit Logs Tab */
              <div>
                <div className="mb-6 px-2">
                  <h3 className="font-poppins font-semibold text-xl text-slate-800">
                    System Audit Logs
                  </h3>
                  <span className="text-xs text-[#00A65A] font-poppins font-semibold">
                    Append-only immutable transaction entries
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-400 font-poppins">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Actor Details</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Description / Entity</th>
                        <th className="py-3 px-4">Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-poppins text-xs font-medium text-[#292D32]">
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/55 transition-all text-[11px]">
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className="block font-semibold text-slate-800">
                                {log.actor?.name || "System Process"}
                              </span>
                              <span className="block text-[9px] text-slate-400">
                                Role: {log.actorRole}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[10px] font-bold text-blue-700 uppercase">
                              {log.action}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {log.entityType} ({log.entityId?.substring(0, 8)}...)
                            </td>
                            <td className="py-3 px-4 max-w-[150px] truncate text-[9px] text-slate-500 bg-slate-50 font-mono" title={JSON.stringify(log.metadata)}>
                              {JSON.stringify(log.metadata)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 px-4 text-center text-slate-400">
                            No audit log transactions registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Admin Info Card Sidebar Panel (4 columns on lg) */}
          <div className="lg:col-span-4 flex flex-col gap-6 w-full">
            
            {/* Admin Profile Card (Blue top border) */}
            <div className="border-t-4 border-[#3482B9] bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center text-center font-poppins">
              <div className="w-24 h-24 rounded-lg border-2 border-slate-200 bg-slate-50 overflow-hidden mb-4 flex items-center justify-center relative shadow-inner">
                <div className="w-full h-full bg-slate-100 flex items-center justify-center font-extrabold text-slate-400 text-3xl uppercase">
                  {user.name.charAt(0)}
                </div>
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-1">{user.name}</h3>
              <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 mb-4 select-all">
                Administrator
              </div>

              {/* Extra profile details */}
              <div className="w-full border-t border-slate-100 pt-4 mt-2 space-y-2.5 text-left text-xs text-slate-500 font-medium">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Assigned Role:</span>
                  <span className="font-bold text-slate-700 text-right">{user.role}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Institutional Email:</span>
                  <span className="font-bold text-slate-700 text-right max-w-[130px] truncate" title={user.email}>{user.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">System Logs Cache:</span>
                  <span className="font-bold text-slate-700 text-right font-mono text-[10px]">{auditLogs.length} Records</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Status bypass:</span>
                  <span className="font-bold text-green-700 text-right text-xs uppercase tracking-wider">ACTIVE</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* 5. Student Progress Detail / Override Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-40 p-4 transition-all">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col gap-6 relative max-h-[85vh] overflow-y-auto font-poppins animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setSelectedStudent(null)}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div>
              <h3 className="font-bold text-xl text-slate-800">
                {selectedStudent.user.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Matric: {selectedStudent.matricNumber} / Dept: {selectedStudent.department} / Faculty: {selectedStudent.faculty}
              </p>
            </div>

            <div className="space-y-4">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Requirements Checklist
              </span>
              
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {selectedStudent.clearanceRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-all">
                    <div>
                      <span className="block font-semibold text-xs text-slate-800">
                        {req.clearingUnit.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-block border rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${getUnitStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                      {user.role === "ADMIN" && (
                        <button
                          onClick={() => setOverrideRequest({ id: req.id, unitName: req.clearingUnit.name, currentStatus: req.status })}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#3482B9] text-slate-600 hover:text-[#3482B9] rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Override
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Admin Override Modal */}
      {overrideRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col gap-6 relative animate-in fade-in zoom-in-95 duration-150 font-poppins">
            <button 
              onClick={() => { setOverrideRequest(null); setOverrideNote(""); }}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[#3482B9]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-poppins font-bold text-lg text-slate-800">
                  Manual Clearance Override
                </h3>
                <p className="text-xs text-slate-500 font-poppins">
                  Office: {overrideRequest.unitName} (Current: {overrideRequest.currentStatus})
                </p>
              </div>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Override Justification (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  placeholder="State the administrative reason for this manual clearance override."
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-[#292D32] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3482B9] focus:border-transparent transition-all text-xs resize-none font-poppins font-medium leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={(e) => handleOverrideSubmit(e, "APPROVED")}
                  disabled={overrideLoading || !overrideNote.trim()}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl text-xs font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {overrideLoading ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    "Force Approve"
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleOverrideSubmit(e, "REJECTED")}
                  disabled={overrideLoading || !overrideNote.trim()}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {overrideLoading ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    "Force Reject"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
