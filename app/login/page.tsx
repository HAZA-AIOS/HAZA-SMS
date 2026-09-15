import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { isPlatformAdminEmail } from "../../lib/subscriptions";
import AuthVisualShell from "../AuthVisualShell";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getChatGPTUser();
  const dashboardPath = "/?portal=dashboard";
  const signInPath = chatGPTSignInPath(dashboardPath);

  return (
    <AuthVisualShell title="Welcome" subtitle="Your secure school journey starts here." description="Open the dashboard assigned to your role—school owner, administrator, teacher, accountant, parent or student.">
          <div className="mb-8">
            <span className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-200/75">Secure access</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight">{user ? "Welcome back" : "Sign in to HAZA-SMS"}</h2>
            <p className="mt-2 text-sm leading-6 text-violet-100/65">Use the email address registered or invited by your school.</p>
          </div>

          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-bold text-white/85">Email account</span>
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm text-white/75 shadow-inner">
                <span aria-hidden="true">✉</span>
                <span className="truncate">{user?.email ?? "Your registered email address"}</span>
              </div>
            </div>

            {user ? (
              <a href={dashboardPath} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-700 px-5 text-base font-black text-white shadow-lg shadow-fuchsia-950/40 transition hover:-translate-y-0.5 hover:brightness-110">Open my dashboard</a>
            ) : (
              <a href={signInPath} target="_top" className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-700 px-5 text-base font-black text-white shadow-lg shadow-fuchsia-950/40 transition hover:-translate-y-0.5 hover:brightness-110">Continue with email</a>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-violet-100/65">
              <strong className="block text-white/90">No separate dashboard password</strong>
              HAZA-SMS verifies your email securely and never displays or stores a school dashboard password.
            </div>

            <p className="text-center text-sm text-violet-100/70">
              New school?{" "}
              <Link href="/register" className="font-black text-white underline decoration-fuchsia-300 underline-offset-4">Register your school</Link>
            </p>
            {user && isPlatformAdminEmail(user.email) ? <Link href="/platform-admin/subscriptions" className="block text-center text-sm font-semibold text-fuchsia-200 hover:text-white">Manage school subscriptions</Link> : null}
            <Link href="/" className="block text-center text-sm font-semibold text-violet-100/60 hover:text-white">← Return to public website</Link>
          </div>
    </AuthVisualShell>
  );
}
