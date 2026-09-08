"use client";
import { useState, type CSSProperties } from "react";
import AccessControlPanel, { type AccessData } from "./AccessControlPanel";
import ConfigurationPanel, {
  type ConfigurationData,
} from "./ConfigurationPanel";
import SecurityPanel, { type SecurityData } from "./SecurityPanel";
import StudentDirectoryPanel, {
  type StudentDirectoryData,
} from "./StudentDirectoryPanel";
import HomeDashboardPanel from "./HomeDashboardPanel";
import AdmissionsPanel, { type AdmissionsData } from "./AdmissionsPanel";
import StaffDirectoryPanel, {
  type StaffDirectoryData,
} from "./StaffDirectoryPanel";
import TeachersPanel, { type TeachersData } from "./TeachersPanel";
import StaffAttendancePanel, {
  type StaffAttendanceData,
} from "./StaffAttendancePanel";
import PayrollPanel, { type PayrollData } from "./PayrollPanel";
import AcademicsPanel, { type AcademicsData } from "./AcademicsPanel";
import PromotionPanel from "./PromotionPanel";
import StudentAttendancePanel from "./StudentAttendancePanel";
import TimetablePanel from "./TimetablePanel";
import ExaminationSchedulePanel from "./ExaminationSchedulePanel";
import FeesPanel from "./FeesPanel";
import type { CampusChoice } from "../lib/authorization";
import { cn } from "./ui/TailwindPrimitives";
import PublicContentPanel, { type PublicContentData } from "./PublicContentPanel";
import LearningPanel from "./LearningPanel";
import CommunicationsPanel from "./CommunicationsPanel";
import PortalPanel from "./PortalPanel";

const navigation = [
  ["🏠", "Home"],
  ["🤝", "Admissions"],
  ["🎓", "Students"],
  ["🪪", "Staff"],
  ["🧑‍🏫", "Teachers"],
  ["📅", "Student Attendance"],
  ["🗓️", "Staff Attendance"],
  ["💵", "Payroll"],
  ["⚙️", "Configuration"],
  ["🔐", "Access Control"],
  ["🛡️", "Security & Audit"],
  ["🏫", "Academics"],
  ["⬆️", "Promotions"],
  ["📚", "Classes"],
  ["🔳", "Timetable"],
  ["🏅", "Examinations"],
  ["📖", "Learning"],
  ["💰", "Fees"],
  ["🫆", "Biometrics"],
  ["🧾", "Accounts"],
  ["🪙", "Expenses"],
  ["💬", "Communication"],
  ["👨‍👩‍👧", "My Portal"],
  ["⬇️", "Downloads"],
  ["📰", "News & Events"],
  ["🖨️", "Reports"],
] as const;

export default function DashboardShell({
  schoolName,
  activeCampusId,
  campuses,
  organizationWide,
  userName,
  canViewPromotions,
  canViewStudentAttendance,
  canViewTimetable,
  canViewExaminations,
  canViewLearning,
  canViewCommunications,
  canViewPortal,
  canViewFees,
  accessData,
  configurationData,
  securityData,
  studentDirectoryData,
  admissionsData,
  staffDirectoryData,
  teachersData,
  staffAttendanceData,
  payrollData,
  academicsData,
  publicContentData,
}: {
  schoolName: string;
  activeCampusId: string | null;
  campuses: CampusChoice[];
  organizationWide: boolean;
  userName: string;
  canViewPromotions: boolean;
  canViewStudentAttendance: boolean;
  canViewTimetable: boolean;
  canViewExaminations: boolean;
  canViewLearning: boolean;
  canViewCommunications: boolean;
  canViewPortal: boolean;
  canViewFees: boolean;
  accessData: AccessData | null;
  configurationData: ConfigurationData | null;
  securityData: SecurityData | null;
  studentDirectoryData: StudentDirectoryData | null;
  admissionsData: AdmissionsData | null;
  staffDirectoryData: StaffDirectoryData | null;
  teachersData: TeachersData | null;
  staffAttendanceData: StaffAttendanceData | null;
  payrollData: PayrollData | null;
  academicsData: AcademicsData | null;
  publicContentData: PublicContentData | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);
  const [activeView, setActiveView] = useState("Home");
  const initials = userName
    .split(/\s+/)
    .map((v) => v[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const campusName = activeCampusId
    ? (campuses.find((c) => c.id === activeCampusId)?.name ?? "Campus")
    : "All campuses";
  async function chooseCampus(campusId: string) {
    setCampusOpen(false);
    const response = await fetch("/api/session/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campusId }),
    });
    if (response.ok) window.location.reload();
  }
  return (
    <main className="tms-dashboard min-h-screen bg-[#07091a] text-slate-100" style={{"--dashboard-sidebar-width":collapsed?"72px":"232px"} as CSSProperties}>
      <header className="dashboard-header fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-violet-400/15 bg-[#171234]/95 px-4 shadow-[0_12px_35px_rgba(3,4,15,.3)] backdrop-blur-xl transition-[left] duration-200 lg:px-6">
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg text-white/80 transition hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-white"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => { if (window.innerWidth < 1024) setMobileOpen(true); else setCollapsed((v) => !v); }}
        >
          ☰
        </button>
        {activeView !== "Home" && (
          <button
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/5 hover:text-white sm:flex"
            type="button"
            onClick={() => setActiveView("Home")}
            aria-label="Back to dashboard"
          >
            <span aria-hidden="true">←</span>
            <b>Dashboard</b>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-base font-semibold text-white sm:text-lg">{activeView}</strong>
          <small className="hidden truncate text-xs text-violet-200/55 sm:block">Manage your school with clarity and confidence.</small>
        </div>
        <div className="relative hidden md:block">
          <button
            className="flex min-w-44 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/80 transition hover:border-violet-400/40 hover:bg-violet-500/10"
            type="button"
            aria-expanded={campusOpen}
            onClick={() => setCampusOpen((v) => !v)}
          >
            <span className="truncate">🏫 {campusName}</span>
            <span className={cn("transition-transform", campusOpen && "rotate-180")}>⌄</span>
          </button>
          {campusOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 grid min-w-56 gap-1 rounded-xl border border-white/10 bg-[#11142d] p-2 text-white shadow-2xl" role="menu">
              {organizationWide && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => chooseCampus("all")}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-violet-500/15"
                >
                  🏢 All campuses
                </button>
              )}
              {campuses.map((campus) => (
                <button
                  type="button"
                  role="menuitem"
                  key={campus.id}
                  onClick={() => chooseCampus(campus.id)}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-violet-500/15"
                >
                  🏫 {campus.name}
                  {campus.id === activeCampusId ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 xl:flex">
            <span aria-hidden="true">🔎</span>
            <input
              aria-label="Find students or employees"
              placeholder="Find students or employees"
              className="w-56 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </label>
          <button
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-violet-500/15"
            type="button"
            aria-label="Notifications"
          >
            🔔
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-fuchsia-500 ring-2 ring-[#080a1c]" />
          </button>
          <a
            className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white shadow-[0_8px_24px_rgba(168,85,247,.3)]"
            href="/signout-with-chatgpt?return_to=/"
            aria-label="Sign out"
            title="Sign out"
          >
            {initials}
          </a>
        </div>
      </header>
      {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={()=>setMobileOpen(false)} />}
      <aside className={cn("dashboard-sidebar fixed inset-y-0 left-0 z-50 flex w-[232px] -translate-x-full flex-col overflow-hidden border-r border-white/10 bg-[#090b20] text-white shadow-2xl transition-[width,transform] duration-200 lg:translate-x-0", mobileOpen && "translate-x-0") }>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-3.5">
          <img
            src="/tms-original-logo-transparent.png"
            alt="The Mentor School logo"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className={cn("min-w-0 flex-1 transition-opacity", collapsed && "hidden")}>
            <strong className="block truncate text-sm font-semibold">{schoolName}</strong>
            <small className="block truncate text-[11px] uppercase tracking-[.16em] text-violet-200/45">School Management</small>
          </span>
          <button
            className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-white/45 hover:bg-white/10 hover:text-white",collapsed&&"hidden")}
            onClick={() => { if (window.innerWidth < 1024) setMobileOpen(false); else setCollapsed((v) => !v); }}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Main navigation">
          {navigation.map(([icon, label]) => (
            <button
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-white/55 transition hover:bg-white/6 hover:text-white", activeView === label && "bg-gradient-to-r from-violet-600/90 to-fuchsia-600/80 text-white shadow-lg shadow-violet-950/40", collapsed&&"lg:mx-auto lg:h-11 lg:w-11 lg:justify-center lg:p-0")}
              type="button"
              key={label}
              title={label}
              onClick={() => {
                if (
                  label === "Home" ||
                  label === "Admissions" ||
                  label === "Students" ||
                  label === "Staff" ||
                  label === "Teachers" ||
                  (label === "Student Attendance" &&
                    canViewStudentAttendance) ||
                  label === "Staff Attendance" ||
                  label === "Payroll" ||
                  label === "Academics" ||
                  (label === "Promotions" && canViewPromotions) ||
                  (label === "Timetable" && canViewTimetable) ||
                  (label === "Examinations" && canViewExaminations) ||
                  (label === "Learning" && canViewLearning) ||
                  (label === "Communication" && canViewCommunications) ||
                  (label === "My Portal" && canViewPortal) ||
                  (label === "Fees" && canViewFees) ||
                  label === "Configuration" ||
                  (label === "Downloads" && !!publicContentData) ||
                  (label === "News & Events" && !!publicContentData) ||
                  label === "Access Control" ||
                  label === "Security & Audit"
                ) {
                  setActiveView(label);
                  setMobileOpen(false);
                }
              }}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center text-xl leading-none" aria-hidden="true">
                {icon}
              </span>
              <span className={cn("truncate transition-opacity", collapsed && "hidden")}>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section
        className="dashboard-workspace min-h-screen px-4 pb-8 pt-20 transition-[margin] duration-200 sm:px-5 lg:px-6"
        aria-label="Workspace"
      >
        {activeView === "Home" ? (
          <HomeDashboardPanel
            schoolName={schoolName}
            userName={userName}
            accessData={accessData}
            configurationData={configurationData}
            securityData={securityData}
            studentData={studentDirectoryData}
            onNavigate={setActiveView}
          />
        ) : activeView === "Admissions" && admissionsData ? (
          <AdmissionsPanel data={admissionsData} />
        ) : activeView === "Students" && studentDirectoryData ? (
          <StudentDirectoryPanel data={studentDirectoryData} />
        ) : activeView === "Staff" && staffDirectoryData ? (
          <StaffDirectoryPanel data={staffDirectoryData} />
        ) : activeView === "Teachers" && teachersData ? (
          <TeachersPanel data={teachersData} />
        ) : activeView === "Student Attendance" && canViewStudentAttendance ? (
          <StudentAttendancePanel />
        ) : activeView === "Staff Attendance" && staffAttendanceData ? (
          <StaffAttendancePanel data={staffAttendanceData} />
        ) : activeView === "Payroll" && payrollData ? (
          <PayrollPanel data={payrollData} />
        ) : activeView === "Academics" && academicsData ? (
          <AcademicsPanel data={academicsData} />
        ) : activeView === "Promotions" && canViewPromotions ? (
          <PromotionPanel />
        ) : activeView === "Timetable" && canViewTimetable ? (
          <TimetablePanel />
        ) : activeView === "Examinations" && canViewExaminations ? (
          <ExaminationSchedulePanel />
        ) : activeView === "Learning" && canViewLearning ? (
          <LearningPanel />
        ) : activeView === "Communication" && canViewCommunications ? (
          <CommunicationsPanel />
        ) : activeView === "My Portal" && canViewPortal ? (
          <PortalPanel />
        ) : activeView === "Fees" && canViewFees ? (
          <FeesPanel />
        ) : activeView === "Downloads" && publicContentData ? (
          <PublicContentPanel data={publicContentData} initialTab="downloads" />
        ) : activeView === "News & Events" && publicContentData ? (
          <PublicContentPanel data={publicContentData} initialTab="news" />
        ) : activeView === "Configuration" && configurationData ? (
          <ConfigurationPanel data={configurationData} />
        ) : activeView === "Access Control" && accessData ? (
          <AccessControlPanel data={accessData} />
        ) : activeView === "Security & Audit" && securityData ? (
          <SecurityPanel data={securityData} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <span className="text-xs font-black uppercase tracking-[.18em] text-red-600">PROTECTED WORKSPACE</span>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{schoolName}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Signed in securely as {userName}. This section is not
                  available for your role.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-200">Authenticated</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
