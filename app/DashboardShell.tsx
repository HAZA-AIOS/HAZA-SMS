"use client";
import { useState } from "react";
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
  ["💰", "Fees"],
  ["🫆", "Biometrics"],
  ["🧾", "Accounts"],
  ["🪙", "Expenses"],
  ["💬", "Messages"],
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
}) {
  const [collapsed, setCollapsed] = useState(false);
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
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className={cn("fixed inset-x-0 top-0 z-40 flex h-[72px] items-center gap-3 border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur transition-[left] duration-200 lg:left-[260px] lg:px-6", collapsed && "lg:left-[76px]")}>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((v) => !v)}
        >
          ☰
        </button>
        {activeView !== "Home" && (
          <button
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 sm:flex"
            type="button"
            onClick={() => setActiveView("Home")}
            aria-label="Back to dashboard"
          >
            <span aria-hidden="true">←</span>
            <b>Dashboard</b>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-base font-extrabold text-slate-950 sm:text-lg">{activeView}</strong>
          <small className="hidden truncate text-xs text-slate-500 sm:block">Manage your school with clarity and confidence.</small>
        </div>
        <div className="relative hidden md:block">
          <button
            className="flex min-w-44 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
            type="button"
            aria-expanded={campusOpen}
            onClick={() => setCampusOpen((v) => !v)}
          >
            <span className="truncate">🏫 {campusName}</span>
            <span className={cn("transition-transform", campusOpen && "rotate-180")}>⌄</span>
          </button>
          {campusOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 grid min-w-56 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl" role="menu">
              {organizationWide && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => chooseCampus("all")}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-100"
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
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-100"
                >
                  🏫 {campus.name}
                  {campus.id === activeCampusId ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 xl:flex">
            <span aria-hidden="true">🔎</span>
            <input
              aria-label="Find students or employees"
              placeholder="Find students or employees"
              className="w-56 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
          <button
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"
            type="button"
            aria-label="Notifications"
          >
            🔔
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          <a
            className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-red-600 to-red-500 text-sm font-black text-white shadow-sm"
            href="/signout-with-chatgpt?return_to=/"
            aria-label="Sign out"
            title="Sign out"
          >
            {initials}
          </a>
        </div>
      </header>
      <aside className={cn("fixed inset-y-0 left-0 z-50 hidden w-[260px] flex-col overflow-hidden bg-[#090b0a] text-white shadow-2xl transition-[width] duration-200 lg:flex", collapsed && "w-[76px]")}>
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <img
            src="/tms-original-logo-transparent.png"
            alt="The Mentor School logo"
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className={cn("min-w-0 flex-1 transition-opacity", collapsed && "pointer-events-none opacity-0")}>
            <strong className="block truncate text-sm font-extrabold">{schoolName}</strong>
            <small className="block truncate text-[11px] uppercase tracking-widest text-zinc-500">School Management</small>
          </span>
          <button
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {navigation.map(([icon, label]) => (
            <button
              className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-400 transition hover:bg-white/8 hover:text-white", activeView === label && "bg-red-600 text-white shadow-lg shadow-red-950/30")}
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
                  (label === "Fees" && canViewFees) ||
                  label === "Configuration" ||
                  label === "Access Control" ||
                  label === "Security & Audit"
                )
                  setActiveView(label);
              }}
            >
              <span className="grid w-6 shrink-0 place-items-center text-base" aria-hidden="true">
                {icon}
              </span>
              <span className={cn("truncate transition-opacity", collapsed && "pointer-events-none opacity-0")}>{label}</span>
            </button>
          ))}
        </nav>
        <div className={cn("m-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-opacity", collapsed && "pointer-events-none opacity-0")}>
          <span className="text-xl">✨</span>
          <strong className="mt-2 block text-sm">Build better schools</strong>
          <p className="my-2 text-xs leading-relaxed text-zinc-500">Your secure digital campus is growing.</p>
          <button className="text-xs font-bold text-yellow-400 hover:text-yellow-300" onClick={() => setActiveView("Configuration")}>
            Continue setup
          </button>
        </div>
      </aside>
      <section
        className={cn("min-h-screen px-4 pb-8 pt-[92px] transition-[margin] duration-200 sm:px-6 lg:ml-[260px] lg:px-8", collapsed && "lg:ml-[76px]")}
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
        ) : activeView === "Fees" && canViewFees ? (
          <FeesPanel />
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
