import Image from "next/image";
import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getChatGPTUser();
  const dashboardPath = "/?portal=dashboard";
  const signInPath = chatGPTSignInPath(dashboardPath);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#10051f] text-white">
      <Image
        src="/tms-landing-hero.jpg"
        alt="Students learning at The Mentor School"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(26,4,61,.96)_0%,rgba(77,16,139,.83)_45%,rgba(122,28,163,.72)_100%)]" />
      <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full border-[18px] border-fuchsia-300/20" aria-hidden="true" />
      <div className="absolute -bottom-24 left-[18%] h-52 w-52 rounded-full border-[18px] border-violet-300/20" aria-hidden="true" />
      <div className="absolute -right-10 top-[58%] h-36 w-36 rounded-full border-[14px] border-pink-300/20" aria-hidden="true" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12">
        <div className="max-w-xl text-center lg:text-left">
          <div className="mb-10 flex items-center justify-center gap-4 lg:justify-start">
            <span className="grid h-20 w-20 place-items-center rounded-3xl border border-white/20 bg-white/95 p-2 shadow-2xl shadow-fuchsia-950/40">
              <Image src="/tms-original-logo-transparent.png" alt="The Mentor School original logo" width={64} height={64} className="h-full w-full object-contain" />
            </span>
            <span>
              <strong className="block text-xl font-black tracking-wide sm:text-2xl">دی منٹور سکول</strong>
              <small className="mt-1 block text-sm font-bold uppercase tracking-[.22em] text-violet-100/70">HAZA-SMS</small>
            </span>
          </div>
          <p className="text-sm font-bold uppercase tracking-[.32em] text-fuchsia-200/80">Education for life</p>
          <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">Welcome</h1>
          <p className="mt-4 text-lg font-medium tracking-[.16em] text-white/80 sm:text-xl">Your secure school journey starts here.</p>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-violet-100/70 lg:mx-0">Open the dashboard assigned to your role—school owner, administrator, teacher, accountant, parent or student.</p>
        </div>

        <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-white/15 bg-[#260b45]/75 p-6 shadow-[0_35px_100px_rgba(12,2,35,.55)] backdrop-blur-2xl sm:p-10">
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
              <a href={user ? dashboardPath : signInPath} target={user ? undefined : "_top"} className="font-black text-white underline decoration-fuchsia-300 underline-offset-4">Register your school</a>
            </p>
            <Link href="/" className="block text-center text-sm font-semibold text-violet-100/60 hover:text-white">← Return to public website</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
