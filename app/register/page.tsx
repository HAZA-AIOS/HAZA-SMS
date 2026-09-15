import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import RegistrationForm from "../RegistrationForm";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { getOrganizationChoices } from "../../lib/authorization";
import { isRegistrationPlan } from "../../lib/subscriptions";

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
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#7e22ce_0,#31075c_36%,#10051f_78%)] px-5 py-10 text-white">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white p-1"><Image src="/tms-original-logo-transparent.png" alt="The Mentor School logo" width={48} height={48} /></span><span><strong className="block">HAZA-SMS</strong><small className="text-violet-200/70">School registration</small></span></Link>
        <Link href="/login" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">School sign in</Link>
      </header>
      <section className="mx-auto mt-16 max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[.3em] text-fuchsia-200">Simple school pricing</p><h1 className="mt-4 text-4xl font-black sm:text-6xl">Start with a secure school workspace</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-violet-100/70">Choose a plan, verify your email securely, then register your school. Paid dashboards activate only after payment receipt approval.</p></section>
      <section className="mt-12 grid gap-5 md:grid-cols-3">{plans.map(item => <article key={item.key} className={`rounded-3xl border p-7 backdrop-blur ${item.key === "yearly" ? "border-fuchsia-300/60 bg-fuchsia-400/15" : "border-white/15 bg-white/[.07]"}`}>
        {item.key === "yearly" ? <span className="rounded-full bg-fuchsia-300 px-3 py-1 text-xs font-black text-purple-950">BEST VALUE</span> : null}
        <h2 className="mt-5 text-2xl font-black">{item.name}</h2><p className="mt-5 text-4xl font-black">{item.price}</p><p className="mt-1 text-sm text-violet-200/65">{item.cadence}</p><p className="mt-5 min-h-20 leading-7 text-violet-100/70">{item.note}</p>
        <a href={chatGPTSignInPath(`/register?plan=${item.key}`)} target="_top" className="mt-7 flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-4 font-black shadow-lg">{item.key === "demo" ? "Start 7-day demo" : `Choose ${item.name}`}</a>
      </article>)}</section>
      <p className="mt-8 text-center text-sm text-violet-200/60">No dashboard password is stored. HAZA-SMS uses secure email verification.</p>
    </div>
  </main>;
}
