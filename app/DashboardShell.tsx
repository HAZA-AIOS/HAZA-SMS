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
import type { CampusChoice } from "../lib/authorization";

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
    <main className="app-shell">
      <header className={`topbar ${collapsed ? "sidebar-is-collapsed" : ""}`}>
        <button
          className="menu-button"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((v) => !v)}
        >
          ☰
        </button>
        {activeView !== "Home" && (
          <button
            className="dashboard-back"
            type="button"
            onClick={() => setActiveView("Home")}
            aria-label="Back to dashboard"
          >
            <span aria-hidden="true">←</span>
            <b>Dashboard</b>
          </button>
        )}
        <div className="topbar-greeting">
          <strong>{activeView}</strong>
          <small>Manage your school with clarity and confidence.</small>
        </div>
        <div className="campus-control">
          <button
            className="campus-switcher"
            type="button"
            aria-expanded={campusOpen}
            onClick={() => setCampusOpen((v) => !v)}
          >
            <span className="campus-name">🏫 {campusName}</span>
            <span className={`chevron ${campusOpen ? "open" : ""}`}>⌄</span>
          </button>
          {campusOpen && (
            <div className="campus-menu" role="menu">
              {organizationWide && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => chooseCampus("all")}
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
                >
                  🏫 {campus.name}
                  {campus.id === activeCampusId ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="topbar-actions">
          <label className="search-box">
            <span aria-hidden="true">🔎</span>
            <input
              aria-label="Find students or employees"
              placeholder="Find students or employees"
            />
          </label>
          <button
            className="help-button notification-button"
            type="button"
            aria-label="Notifications"
          >
            🔔
            <i />
          </button>
          <a
            className="avatar"
            href="/signout-with-chatgpt?return_to=/"
            aria-label="Sign out"
            title="Sign out"
          >
            {initials}
          </a>
        </div>
      </header>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <img
            src="/tms-original-logo-transparent.png"
            alt="The Mentor School logo"
          />
          <span>
            <strong>{schoolName}</strong>
            <small>School Management</small>
          </span>
          <button
            className="sidebar-collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map(([icon, label]) => (
            <button
              className={activeView === label ? "nav-item active" : "nav-item"}
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
                  label === "Configuration" ||
                  label === "Access Control" ||
                  label === "Security & Audit"
                )
                  setActiveView(label);
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>✨</span>
          <strong>Build better schools</strong>
          <p>Your secure digital campus is growing.</p>
          <button onClick={() => setActiveView("Configuration")}>
            Continue setup
          </button>
        </div>
      </aside>
      <section
        className={`empty-workspace ${collapsed ? "sidebar-collapsed" : ""}`}
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
        ) : activeView === "Configuration" && configurationData ? (
          <ConfigurationPanel data={configurationData} />
        ) : activeView === "Access Control" && accessData ? (
          <AccessControlPanel data={accessData} />
        ) : activeView === "Security & Audit" && securityData ? (
          <SecurityPanel data={securityData} />
        ) : (
          <div className="foundation-page">
            <div className="phase-heading">
              <div>
                <span className="eyebrow">PROTECTED WORKSPACE</span>
                <h1>{schoolName}</h1>
                <p>
                  Signed in securely as {userName}. This section is not
                  available for your role.
                </p>
              </div>
              <span className="phase-badge complete">Authenticated</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
