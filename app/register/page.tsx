import Link from "next/link";
import { redirect } from "next/navigation";
import RegistrationForm from "../RegistrationForm";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { getOrganizationChoices } from "../../lib/authorization";
import { isRegistrationPlan } from "../../lib/subscriptions";
import AuthVisualShell from "../AuthVisualShell";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const requested = (await searchParams).plan;
  const plan = isRegistrationPlan(requested) ? requested : "demo";
  const user = await getChatGPTUser();
  if (user && (await getOrganizationChoices()).length) redirect("/?portal=dashboard");
  if (user) return <RegistrationForm email={user.email} displayName={user.displayName} selectedPlan={plan} />;

  const plans = [
    { key: "demo", name: "7-day demo", price: "Rs. 0", cadence: "for 7 days", note: "Explore your own private school workspace before subscribing." },
    { key: "monthly", name: "Monthly", price: "Rs. 5,000", cadence: "per month", note: "Flexible monthly access after receipt approval." },
    { key: "yearly", name: "Yearly", price: "Rs. 50,000", cadence: "per year", note: "Save Rs. 10,000 compared with monthly billing." },
  ] as const;
  return <AuthVisualShell wide title="Register your school" subtitle="Choose a plan and start your secure school journey." description="Verify your email, create your private workspace and manage every campus through one role-based system." points={["7-day private demo", "Manual payment approval", "No separate dashboard password"]}>
    <div className="mb-7"><span className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-200/75">School onboarding</span><h2 className="mt-3 text-3xl font-black tracking-tight">Choose your access plan</h2><p className="mt-2 text-sm leading-6 text-violet-100/65">Paid dashboard access begins after your payment receipt is approved.</p></div>
    <div className="grid gap-4">{plans.map(item => <article key={item.key} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${item.key === "yearly" ? "border-fuchsia-300/45 bg-fuchsia-400/12" : "border-white/12 bg-white/[.07]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-xl font-black">{item.name}</h3>{item.key === "yearly" ? <span className="rounded-full bg-fuchsia-300 px-2.5 py-1 text-xs font-black text-purple-950">BEST VALUE</span> : null}</div><p className="mt-2 text-sm leading-6 text-violet-100/65">{item.note}</p></div><div className="text-right"><strong className="block text-2xl text-white">{item.price}</strong><small className="text-violet-200/60">{item.cadence}</small></div></div>
      <a href={chatGPTSignInPath(`/register?plan=${item.key}`)} target="_top" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-700 px-4 font-black text-white shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110">{item.key === "demo" ? "Start 7-day demo" : `Choose ${item.name}`}</a>
    </article>)}</div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-violet-100/65"><Link href="/login" className="font-bold text-white underline decoration-fuchsia-300 underline-offset-4">Already registered? Sign in</Link><Link href="/" className="font-semibold hover:text-white">← Public website</Link></div>
  </AuthVisualShell>;
}
