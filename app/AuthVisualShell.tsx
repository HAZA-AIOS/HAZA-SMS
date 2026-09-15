import Image from "next/image";
import type { ReactNode } from "react";

type AuthVisualShellProps = {
  children: ReactNode;
  title: string;
  subtitle: string;
  description: string;
  points?: string[];
  wide?: boolean;
};

export default function AuthVisualShell({ children, title, subtitle, description, points = [], wide = false }: AuthVisualShellProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#10051f] text-white">
      <Image src="/tms-landing-hero.jpg" alt="Students learning at The Mentor School" fill priority sizes="100vw" className="fixed object-cover object-center" />
      <div className="fixed inset-0 bg-[linear-gradient(105deg,rgba(26,4,61,.96)_0%,rgba(77,16,139,.83)_45%,rgba(122,28,163,.72)_100%)]" />
      <div className="fixed -left-16 -top-20 h-52 w-52 rounded-full border-[18px] border-fuchsia-300/20" aria-hidden="true" />
      <div className="fixed -bottom-24 left-[18%] h-52 w-52 rounded-full border-[18px] border-violet-300/20" aria-hidden="true" />
      <div className="fixed -right-10 top-[58%] h-36 w-36 rounded-full border-[14px] border-pink-300/20" aria-hidden="true" />

      <section className={`relative mx-auto grid min-h-screen w-full max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:px-12 ${wide ? "lg:grid-cols-[.82fr_1.18fr]" : "lg:grid-cols-[1.05fr_.95fr]"}`}>
        <div className="flex max-w-xl flex-col justify-center text-center lg:sticky lg:top-0 lg:min-h-screen lg:text-left">
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
          <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">{title}</h1>
          <p className="mt-4 text-lg font-medium tracking-[.12em] text-white/80 sm:text-xl">{subtitle}</p>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-violet-100/70 lg:mx-0">{description}</p>
          {points.length ? <div className="mx-auto mt-6 grid max-w-lg gap-2 text-left text-sm text-violet-100/75 lg:mx-0">{points.map(point => <span key={point}>✓ {point}</span>)}</div> : null}
        </div>

        <div className={`mx-auto flex w-full items-center py-2 ${wide ? "max-w-2xl" : "max-w-lg"}`}>
          <div className="w-full rounded-[2rem] border border-white/15 bg-[#260b45]/80 p-6 shadow-[0_35px_100px_rgba(12,2,35,.55)] backdrop-blur-2xl sm:p-10">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
