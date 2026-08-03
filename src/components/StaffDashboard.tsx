"use client";

import { useState, useEffect } from "react";
import { 
  GraduationCap, 
  LayoutDashboard, 
  HelpCircle, 
  LogOut, 
  Search, 
  ChevronDown, 
  Users, 
  Clock, 
  CheckSquare, 
  Eye, 
  Check, 
  X,
  Menu,
  Smile,
  Loader2,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

interface Document {
  id: string;
  fileName: string;
  fileUrl: string;
  checksum: string;
  uploadedAt: string;
}

interface Submission {
  id: string;
  studentId: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionNote: string | null;
  student: {
    matricNumber: string;
    department: string;
    faculty: string;
    user: {
      name: string;
      email: string;
    };
  };
  documents: Document[];
}

interface StaffDashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

export default function StaffDashboard({ user, onLogout }: StaffDashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [unitName, setUnitName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<Submission | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("dscs_token") : null;

  const fetchSubmissions = async () => {
    try {
      const staffRes = await fetch("/api/admin/staff", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const staffData = await staffRes.json();
      
      const currentStaff = staffData.staff?.find((s: any) => s.userId === user.id);
      const assignedUnit = currentStaff?.assignments?.[0]?.clearingUnit;

      if (assignedUnit) {
        setUnitName(assignedUnit.name);
        setUnitId(assignedUnit.id);
        
        const subRes = await fetch(`/api/units/${assignedUnit.id}/submissions`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const subData = await subRes.json();
        setSubmissions(subData.submissions || []);
      }
    } catch (e) {
      console.error("Error loading staff review queue:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSubmissions();
    }
  }, [token]);

  const handleApprove = async (requestId: string) => {
    if (!confirm("Are you sure you want to approve this student's clearance request?")) return;
    setActionLoading(requestId);

    try {
      const res = await fetch(`/api/submissions/${requestId}/approve`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Approval failed");
      }

      fetchSubmissions();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest || !rejectionNote.trim()) return;
    
    const requestId = rejectingRequest.id;
    setActionLoading(requestId);

    try {
      const res = await fetch(`/api/submissions/${requestId}/reject`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ rejectionNote })
      });
      
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Rejection failed");
      }

      setRejectingRequest(null);
      setRejectionNote("");
      fetchSubmissions();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter & Search table submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.student.user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          sub.student.matricNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sub.student.department.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "pending") return matchesSearch && (sub.status === "PENDING_REVIEW" || sub.status === "UNDER_REVIEW");
    if (filterStatus === "approved") return matchesSearch && sub.status === "APPROVED";
    if (filterStatus === "rejected") return matchesSearch && sub.status === "REJECTED";
    return matchesSearch;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "APPROVED":
        return {
          bg: "bg-green-50",
          border: "border-green-300",
          text: "text-green-700",
          label: "Cleared"
        };
      case "REJECTED":
        return {
          bg: "bg-red-50",
          border: "border-red-300",
          text: "text-red-700",
          label: "Rejected"
        };
      default:
        return {
          bg: "bg-amber-50",
          border: "border-amber-300",
          text: "text-amber-700",
          label: "Action Pending"
        };
    }
  };

  // Stats calculation
  const totalSubmissions = submissions.length;
  const pendingCount = submissions.filter(s => s.status === "PENDING_REVIEW" || s.status === "UNDER_REVIEW").length;
  const completedCount = submissions.filter(s => s.status === "APPROVED" || s.status === "REJECTED").length;

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
            Staff Portal
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
                <a href="#" className="flex items-center justify-between px-3.5 py-2.5 bg-[#3482B9] text-white rounded-lg font-poppins font-medium text-xs">
                  <div className="flex items-center gap-2.5">
                    <LayoutDashboard className="w-4 h-4 text-white" />
                    <span>Dashboard</span>
                  </div>
                </a>
                
                <a href="#" className="flex items-center justify-between px-3.5 py-2.5 text-slate-500 hover:bg-slate-50 rounded-lg font-poppins font-medium text-xs">
                  <div className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    <span>Help</span>
                  </div>
                </a>

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
                  <span className="block text-[8px] text-slate-400 font-poppins max-w-[140px] truncate" title={unitName || "Staff Member"}>
                    {unitName || "Staff Member"}
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
            <span className="block text-[10px] sm:text-xs text-[#3482B9] uppercase tracking-wider mb-1">DSCS Staff Portal</span>
            Clearance Review Queue
          </h1>
          
          <div className="bg-[#E2E8F0] px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-2 border border-slate-300/40">
            <LayoutDashboard className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Home</span>
            <span className="text-slate-400 font-normal">&gt;</span>
            <span className="text-slate-500 font-normal">Clearance Queue</span>
          </div>
        </div>

        {/* Portal Statistics widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 font-poppins mb-2">
          {/* Card 1: Total Submissions (Green) */}
          <div className="bg-[#00A65A] text-white rounded-xl shadow-md overflow-hidden flex flex-col justify-between min-h-[140px] transform hover:scale-[1.01] transition-transform">
            <div className="p-4 sm:p-6">
              <span className="block font-bold text-4xl sm:text-5xl mb-1">{totalSubmissions}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Total Submissions</span>
            </div>
            <div 
              className="bg-black/10 py-2.5 px-4 text-center text-[10px] sm:text-xs font-semibold text-white/95 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/20 transition-colors" 
              onClick={() => handleScrollToSection("queue")}
            >
              <span>More info</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: Action Pending (Orange) */}
          <div className="bg-[#F39C12] text-white rounded-xl shadow-md overflow-hidden flex flex-col justify-between min-h-[140px] transform hover:scale-[1.01] transition-transform">
            <div className="p-4 sm:p-6">
              <span className="block font-bold text-4xl sm:text-5xl mb-1">{pendingCount}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Pending Action</span>
            </div>
            <div 
              className="bg-black/10 py-2.5 px-4 text-center text-[10px] sm:text-xs font-semibold text-white/95 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/20 transition-colors" 
              onClick={() => handleScrollToSection("queue")}
            >
              <span>More info</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Completed Reviews (Red style) */}
          <div className="bg-[#DD4B39] text-white rounded-xl shadow-md overflow-hidden flex flex-col justify-between min-h-[140px] transform hover:scale-[1.01] transition-transform">
            <div className="p-4 sm:p-6">
              <span className="block font-bold text-4xl sm:text-5xl mb-1">{completedCount}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Reviewed Requests</span>
            </div>
            <div 
              className="bg-black/10 py-2.5 px-4 text-center text-[10px] sm:text-xs font-semibold text-white/95 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/20 transition-colors" 
              onClick={() => handleScrollToSection("queue")}
            >
              <span>More info</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* 5. Responsive Main Content Queue list */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Clearance Queue List Card (8 columns on lg) */}
          <div id="queue" className="lg:col-span-8 bg-white py-6 px-4 sm:px-6 rounded-2xl shadow-md border border-slate-200 flex flex-col justify-between min-h-[500px]">
            <div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 px-2">
                <div>
                  <h3 className="font-poppins font-semibold text-xl text-slate-800">
                    Clearance Queue
                  </h3>
                  <span className="text-xs text-[#00A65A] font-poppins font-semibold">
                    Graduating Submissions
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
                      placeholder="Search Student or Matric"
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
                      <option value="pending">Pending Action</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Scrollable Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-400 font-poppins">
                      <th className="py-3 px-4">Student Details</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-center">Submission File</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-poppins text-xs font-medium text-[#292D32]">
                    {filteredSubmissions.length > 0 ? (
                      filteredSubmissions.map((sub) => {
                        const style = getStatusStyle(sub.status);
                        const file = sub.documents?.[0];
                        
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/55 transition-all">
                            {/* Student Info */}
                            <td className="py-4 px-4">
                              <span className="block font-semibold text-sm text-slate-800">
                                {sub.student.user.name}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                {sub.student.matricNumber} / {sub.student.user.email}
                              </span>
                            </td>
                            {/* Department */}
                            <td className="py-4 px-4 text-slate-500">
                              {sub.student.department}
                            </td>
                            {/* Submission File */}
                            <td className="py-4 px-4 text-center">
                              {file ? (
                                <a
                                  href={file.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-[#3482B9] hover:underline"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View Doc
                                </a>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No file</span>
                              )}
                            </td>
                            {/* Status */}
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-block border rounded-md px-2.5 py-1 text-[11px] font-semibold ${style.bg} ${style.border} ${style.text} w-28 text-center`}>
                                {style.label}
                              </span>
                            </td>
                            {/* Actions */}
                            <td className="py-4 px-4 text-center">
                              {sub.status === "PENDING_REVIEW" || sub.status === "UNDER_REVIEW" ? (
                                <div className="inline-flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleApprove(sub.id)}
                                    disabled={actionLoading !== null}
                                    className="w-8 h-8 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50"
                                    title="Approve student clearance"
                                  >
                                    {actionLoading === sub.id ? (
                                      <Loader2 className="animate-spin w-4 h-4" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setRejectingRequest(sub)}
                                    disabled={actionLoading !== null}
                                    className="w-8 h-8 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-center hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
                                    title="Reject student clearance"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Finalized</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 px-4 text-center text-slate-400">
                          No submissions in this unit review queue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 px-2 font-poppins text-xs font-semibold">
              <span className="text-slate-400">
                Showing {filteredSubmissions.length} of {submissions.length} entries
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

          {/* Staff Info Card Sidebar Panel (4 columns on lg) */}
          <div className="lg:col-span-4 flex flex-col gap-6 w-full">
            
            {/* Staff Profile Card (Blue top border) */}
            <div className="border-t-4 border-[#3482B9] bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center text-center font-poppins">
              <div className="w-24 h-24 rounded-lg border-2 border-slate-200 bg-slate-50 overflow-hidden mb-4 flex items-center justify-center relative shadow-inner">
                <div className="w-full h-full bg-slate-100 flex items-center justify-center font-extrabold text-slate-400 text-3xl uppercase">
                  {user.name.charAt(0)}
                </div>
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-1">{user.name}</h3>
              <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 mb-4 select-all">
                {unitName || "Staff Member"}
              </div>

              {/* Extra profile details */}
              <div className="w-full border-t border-slate-100 pt-4 mt-2 space-y-2.5 text-left text-xs text-slate-500 font-medium">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Assigned Office:</span>
                  <span className="font-bold text-slate-700 text-right">{unitName || "N/A"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Unit ID:</span>
                  <span className="font-bold text-slate-700 text-right font-mono text-[10px]">{unitId || "N/A"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Institutional Email:</span>
                  <span className="font-bold text-slate-700 text-right max-w-[130px] truncate" title={user.email}>{user.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Access Level:</span>
                  <span className="font-bold text-slate-700 text-right text-xs uppercase tracking-wider text-[#3482B9]">{user.role}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* 6. Rejection Reason Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col gap-6 relative animate-in fade-in zoom-in-95 duration-150 font-poppins">
            <button 
              onClick={() => { setRejectingRequest(null); setRejectionNote(""); }}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-poppins font-bold text-lg text-slate-800">
                  Reject Clearance Request
                </h3>
                <p className="text-xs text-slate-500 font-poppins">
                  Provide specific reasons for rejection to the student
                </p>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Rejection Reason / Remarks
                </label>
                <textarea
                  required
                  rows={4}
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Specify missing documents, unverified details, or administrative requirements..."
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-[#292D32] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3482B9] focus:border-transparent transition-all text-xs resize-none font-poppins font-medium leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading !== null || !rejectionNote.trim()}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === rejectingRequest.id ? (
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                ) : (
                  "Confirm & Submit Rejection"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
