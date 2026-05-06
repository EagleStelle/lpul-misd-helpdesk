import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Download, Calendar } from "lucide-react";
import { realtimeSupabase } from "../../lib/realtimeSupabaseClient";
import { useLoading } from "../../context/LoadingContext";
import { useTicketsCache } from "../../context/TicketsCacheContext";
import {
  useNavbarActions,
  NavbarActionButton,
} from "../../context/NavbarActionsContext";

// Utility functions
function getStatusValue(ticket) {
  return (
    ticket?.Status ?? ticket?.status ?? ticket?.state ?? ticket?.State ?? ""
  );
}

function isClosed(ticket) {
  if (!ticket) return false;
  if (ticket.closed_at) return true;
  const s = String(getStatusValue(ticket)).toLowerCase();
  return s.includes("closed") || s.includes("resolved") || s.includes("done");
}

function escapeCsv(value) {
  const next = String(value ?? "");
  if (next.includes(",") || next.includes('"') || next.includes("\n")) {
    return `"${next.replaceAll('"', '""')}"`;
  }
  return next;
}

// Components
function PieChart({ closedCount, openCount }) {
  const total = Math.max(closedCount + openCount, 1);
  const closedAngle = (closedCount / total) * 360;
  const openAngle = 360 - closedAngle;

  return (
    <div className="flex flex-col items-center gap-5 py-3">
      <div
        className="w-48 h-48 rounded-full grid place-items-center shadow-inner"
        style={{
          background: `conic-gradient(#336be3 0deg ${closedAngle}deg, #e6bc23 ${closedAngle}deg ${
            closedAngle + openAngle
          }deg)`,
        }}
      >
        <div className="w-[116px] h-[116px] rounded-full bg-white dark:bg-zinc-900 grid place-items-center text-5xl font-semibold text-gray-900 dark:text-zinc-100 shadow-md">
          {closedCount + openCount}
        </div>
      </div>
      <div className="w-full flex justify-between px-4 sm:px-10 text-base font-medium text-gray-700 dark:text-zinc-300">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#336be3] shadow-sm" />
          Closed: <span className="font-bold">{closedCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e6bc23] shadow-sm" />
          Open: <span className="font-bold">{openCount}</span>
        </div>
      </div>
    </div>
  );
}

function DepartmentBarChart({ chartData }) {
  const { stats = [], maxTotal = 1 } = chartData || {};

  return (
    <div
      className="flex flex-col gap-3 min-h-[320px]"
      aria-label="Tickets by department bar chart"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 items-end min-h-[240px] py-3">
        {stats.map((item) => {
          const isEmpty = item.total === 0;
          const closedHeight = isEmpty ? 0 : (item.closed / maxTotal) * 100;
          const openHeight = isEmpty ? 0 : (item.open / maxTotal) * 100;

          return (
            <div
              key={item.department}
              className="flex flex-col items-center gap-2 w-full"
            >
              <div
                className={`w-full max-w-[70px] xl:max-w-[90px] h-[220px] flex flex-col-reverse rounded-lg overflow-hidden border relative transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-black/50 ${
                  isEmpty
                    ? "bg-gray-50 dark:bg-zinc-900/50 border-dashed border-gray-300 dark:border-white/10"
                    : "bg-[#f7f8fc] dark:bg-zinc-800/50 border-gray-200 dark:border-white/10"
                }`}
                role="img"
                aria-label={`${item.department}: ${item.total} total, ${item.open} open, ${item.closed} closed`}
              >
                {!isEmpty ? (
                  <>
                    <div
                      className="w-full bg-[#336be3] transition-all duration-500 ease-out"
                      style={{ height: `${closedHeight}%` }}
                      title={`Closed: ${item.closed}`}
                    />
                    <div
                      className="w-full bg-[#e6bc23] transition-all duration-500 ease-out"
                      style={{ height: `${openHeight}%` }}
                      title={`Open: ${item.open}`}
                    />
                  </>
                ) : (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full mx-1 mb-1"
                    title="No tickets"
                  />
                )}
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base font-bold text-gray-900 dark:text-zinc-100">
                  {item.total}
                </span>
                {!isEmpty && (
                  <div className="flex gap-2 text-[11px] font-semibold">
                    <span className="text-[#336be3]">C:{item.closed}</span>
                    <span className="text-[#e6bc23]">O:{item.open}</span>
                  </div>
                )}
              </div>
              <div className="text-[11px] xl:text-xs font-semibold text-center text-gray-500 dark:text-zinc-400 uppercase mt-1">
                {item.department}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-6 justify-center pt-4 mt-3 border-t border-gray-100 dark:border-white/10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full bg-[#336be3] shadow-sm" />
          <span>Closed</span>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e6bc23] shadow-sm" />
          <span>Open</span>
        </div>
      </div>
    </div>
  );
}

const ALL_DEPARTMENTS = [
  "CAS",
  "CBA",
  "CITHM",
  "COECS",
  "LPU-SC",
  "HIGHSCHOOL",
];

// Main Page Component
export default function AdminAnalytics() {
  const { showLoading, hideLoading } = useLoading();
  const { adminTickets } = useTicketsCache();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");

  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const role = localStorage.getItem("userRole");
  const isAdmin = role === "admin";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const toYMDLocal = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const visibleTickets = useMemo(() => {
    if (!fromDate && !toDate) return tickets;
    return tickets.filter((t) => {
      const ymd = toYMDLocal(t.created_at);
      if (!ymd) return false;
      if (fromDate && ymd < fromDate) return false;
      if (toDate && ymd > toDate) return false;
      return true;
    });
  }, [tickets, fromDate, toDate]);

  const formatFilterDate = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    if (!y || !m || !d) return "";
    return `${m}/${d}/${y.slice(-2)}`;
  };

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;

    if (Array.isArray(adminTickets)) {
      setTickets(adminTickets);
      return;
    }

    const fetchTickets = async () => {
      try {
        showLoading();
        setError("");
        const { data, error: supaError } = await realtimeSupabase
          .from("Tickets")
          .select("id,status,closed_at,created_at,Department,Type,Category")
          .order("id", { ascending: false });

        if (supaError) {
          setError(supaError.message || "Failed to load analytics");
          setTickets([]);
          return;
        }
        setTickets(data || []);
      } catch (e) {
        setError(e?.message || "Failed to load analytics");
      } finally {
        hideLoading();
      }
    };
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDatePillClick = (e) => {
    const pill = e.currentTarget;
    const input = pill.querySelector('input[type="date"]');
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      input.focus();
      return;
    }
    input.focus();
    input.click();
  };

  const { closedCount, openCount, departmentChartData } = useMemo(() => {
    const closed = visibleTickets.filter((t) => isClosed(t)).length;
    const open = visibleTickets.length - closed;

    const statsMap = new Map();
    ALL_DEPARTMENTS.forEach((dept) => {
      statsMap.set(dept, { department: dept, total: 0, open: 0, closed: 0 });
    });

    visibleTickets.forEach((ticket) => {
      const dept = (ticket?.Department || "").trim();
      if (!dept) return;

      if (statsMap.has(dept)) {
        const stat = statsMap.get(dept);
        stat.total += 1;
        if (isClosed(ticket)) {
          stat.closed += 1;
        } else {
          stat.open += 1;
        }
      }
    });

    const stats = ALL_DEPARTMENTS.map((dept) => statsMap.get(dept));
    const maxTotal = Math.max(1, ...stats.map((item) => item.total));

    return {
      closedCount: closed,
      openCount: open,
      departmentChartData: {
        stats,
        maxTotal,
      },
    };
  }, [visibleTickets]);

  const onExportCsv = () => {
    const headers = [
      "id",
      "summary",
      "description",
      "department",
      "type",
      "category",
      "site",
      "status",
      "created_at",
      "closed_at",
    ];
    const rows = visibleTickets.map((t) => [
      t.id,
      t.Summary,
      t.Description,
      t.Department,
      t.Type,
      t.Category,
      t.Site,
      t.status || t.Status || "Open",
      t.created_at,
      t.closed_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useNavbarActions(
    <NavbarActionButton
      icon={Download}
      label="Export CSV"
      onClick={onExportCsv}
    />,
  );

  if (!isLoggedIn) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/Tickets" replace />;

  return (
    <div className="w-full min-h-screen bg-[#f9fafb] dark:bg-zinc-950 font-[family:var(--font-poppins)] pt-6 pb-12 transition-colors duration-200">
      <section className="max-w-[1320px] mx-auto px-4 md:px-6">
        {error ? (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
            {error}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-end mb-5">
              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm transition-all hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20 dark:focus-within:ring-white/10"
                role="button"
                tabIndex={0}
                aria-label="Filter by from date"
                onClick={handleDatePillClick}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  handleDatePillClick({ currentTarget: e.currentTarget })
                }
              >
                <span className="relative z-10 pointer-events-none">
                  {fromDate
                    ? `From ${formatFilterDate(fromDate)}`
                    : "From MM/DD/YY"}
                </span>
                <Calendar className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-hover:text-[var(--color-lpu-maroon)] dark:group-hover:text-zinc-300 transition-colors" />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div
                className="relative group flex-1 sm:flex-none cursor-pointer select-none bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-[170px] text-[13px] font-medium text-gray-700 dark:text-zinc-300 shadow-sm transition-all hover:border-[var(--color-lpu-maroon)] dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[var(--color-lpu-maroon)]/20 dark:focus-within:ring-white/10"
                role="button"
                tabIndex={0}
                aria-label="Filter by to date"
                onClick={handleDatePillClick}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  handleDatePillClick({ currentTarget: e.currentTarget })
                }
              >
                <span className="relative z-10 pointer-events-none">
                  {toDate ? `To ${formatFilterDate(toDate)}` : "To MM/DD/YY"}
                </span>
                <Calendar className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-hover:text-[var(--color-lpu-maroon)] dark:group-hover:text-zinc-300 transition-colors" />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {/* Main Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.7fr] gap-6">
              {/* Pie Chart Card */}
              <article className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-5 md:p-7">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                    Total Tickets
                  </h3>
                </div>
                <PieChart closedCount={closedCount} openCount={openCount} />
              </article>

              {/* Bar Chart Card */}
              <article className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-5 md:p-7">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                    Tickets by Department
                  </h3>
                </div>
                <DepartmentBarChart chartData={departmentChartData} />
              </article>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
