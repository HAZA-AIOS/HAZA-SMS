"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

const learning = [
  ["▣", "Bag-Free Learning", "All learning materials are provided at school. Students carry only a light folder—no heavy bags.", "/school/classroom-learning.webp"],
  ["◷", "Minimal Homework", "Learning is completed during school hours. Homework is given only twice a week and is research-based.", "/landing/minimal-homework.jpg"],
  ["⌁", "AI-Enhanced Education", "Students use visual learning and purposeful AI tools to understand concepts that simple teaching cannot.", "/landing/ai-learning.png"],
];

const values = [
  ["▣", "Bag-Free Learning", "Students carry only a light folder. All materials are provided at school—no heavy bags or physical strain.", "/school/classroom-learning.webp"],
  ["⌁", "AI-Enhanced Education", "We use AI technology and visual learning to prepare students for a future built on intelligence.", "/landing/ai-learning.png"],
  ["◎", "Global Curriculum", "An international-standard model means our students can move anywhere and never feel behind.", "/landing/global-learning.png"],
  ["♡", "Stress-Free Growth", "Minimal homework, research-based learning and a nurturing environment where wellbeing comes first.", "/landing/stress-free-growth.png"],
];

const advantages = [
  ["01", "Bag-free learning", "Core learning happens at school through guided practice and carefully planned resources."],
  ["02", "International perspective", "Curriculum draws from respected UK, US and Pakistani learning frameworks."],
  ["03", "Technology with purpose", "Students build useful digital skills through age-appropriate, hands-on learning."],
  ["04", "Low-homework model", "Home stays a place for family, rest and reading—not unfinished schoolwork every evening."],
  ["05", "Character and faith", "Respect, responsibility, Islamic values and service are part of everyday school life."],
  ["06", "Learning beyond books", "Sports, creativity, events and teamwork help children discover their strengths."],
];

const courses = [
  ["English", "UK English", "British subject content builds authentic language, comprehension, writing and confident communication.", "/landing/english-learning.png"],
  ["Mathematics", "California Mathematics", "A deep, guided programme connecting mathematics with science, social studies and technology.", "/landing/mathematics-learning.png"],
  ["Science", "UK KS1 · KS2 · KS3", "Accessible, attractive science content that encourages curiosity, participation and practical understanding.", "/landing/science-learning.png"],
  ["Computing", "Code Studio", "Block-based coding, digital skills and responsible AI research designed for confident new learners.", "/landing/ai-learning.png"],
];

const gradeLevels = [
  ["Reception 1–2", "Discover & communicate", "Play-based language, phonics, early number sense, motor development and confidence-building routines.", ["Early literacy", "Early numeracy", "Creative expression"]],
  ["Grades 1–2", "Build strong foundations", "UK English, California Mathematics and UK KS1 Science taught through visual, guided and practical learning.", ["Reading & writing", "Number fluency", "KS1 discovery"]],
  ["Grades 3–5", "Connect knowledge", "Students deepen comprehension, mathematical reasoning and UK KS2 Science while beginning Code Studio projects and AI research.", ["Independent study", "Integrated projects", "Block coding"]],
  ["Grades 6–8", "Analyse & create", "UK KS3 Science, advanced mathematics, communication and technology projects prepare learners for secondary study and a global future.", ["Critical thinking", "Applied STEM", "Digital fluency"]],
];

const teamGroups = [
  ["/team/shahid-hussain-director.png", "Shahid Hussain", "Director", "Provides strategic direction and supports a safe, purposeful school culture."],
  ["/team/amna-rasool-principal.png", "Amna Rasool", "Principal", "Leads academic quality, student development and the daily learning experience."],
  ["/team/iqra-altaf-vice-principal.jpeg", "Iqra Altaf", "Vice Principal", "Supports teachers and students through organised, caring academic leadership."],
  ["/team/musswar-hussain-it-director.jpg", "Musswar Hussain", "IT Director", "Leads digital learning, school systems, coding and responsible AI integration."],
];

type PublicDownload = { id:string; title:string; description:string|null; original_name:string; size_bytes:number; campus_name:string|null; published_at:number|null };
type PublicNewsEvent = { id:string; kind:string; title:string; summary:string; event_starts_at:number|null; location:string|null; campus_name:string|null; published_at:number|null };

export default function PublicLandingPage({ signInPath, downloads, newsEvents }: { signInPath: string; downloads: PublicDownload[]; newsEvents: PublicNewsEvent[] }) {
  useEffect(() => {
    AOS.init({ duration: 700, easing: "ease-out-cubic", once: true, offset: 70 });
    return () => AOS.refreshHard();
  }, []);

  return (
    <main className="tms-public min-h-screen w-full overflow-x-hidden bg-[#080908] font-sans text-white antialiased selection:bg-red-600 selection:text-white">
      <header className="sticky top-0 z-50 h-[68px] w-full border-b border-violet-500/10 bg-[#05091b]/95 shadow-[0_8px_30px_rgba(0,0,0,.2)] backdrop-blur-xl">
        <div className="mx-auto flex h-full w-[min(1180px,calc(100%-32px))] items-center gap-4">
          <a href="#home" className="mr-auto flex items-center gap-3" aria-label="The Mentor School home">
            <img className="h-9 w-8 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,.5)]" src="/tms-original-logo-transparent.png" alt="The Mentor School original logo" />
            <span className="hidden leading-none sm:block lg:hidden xl:block"><b className="text-[16px] font-extrabold uppercase tracking-[.06em]">The Mentor School</b></span>
          </a>
          <nav className="hidden items-center gap-4 lg:flex xl:gap-6" aria-label="Main navigation">
            {[["#home","Home"],["#why-us","Our Approach"],["#curriculum","Curriculum"],["#team","Our Team"],["#downloads","Downloads"],["#news-events","News & Events"],["#campus","Contact"]].map(([href,label])=><a className="whitespace-nowrap text-[12px] font-medium text-white/85 transition hover:text-violet-300 xl:text-[14px]" href={href} key={href}>{label}</a>)}
          </nav>
          <a className="hidden text-[14px] font-medium text-white/85 transition hover:text-violet-300 md:block" href={signInPath}>Dashboard</a>
          <a className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 px-5 text-[13px] font-bold text-white shadow-[0_0_24px_rgba(124,58,237,.4)] transition hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(168,85,247,.65)]" href="#enroll">Enroll Now</a>
        </div>
      </header>

      <section className="relative isolate w-full overflow-hidden bg-[#05091b]" id="home">
        <img className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-65" src="/landing/hero-technology.png" alt="" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_67%_45%,rgba(126,34,206,.24),transparent_35%),linear-gradient(90deg,rgba(5,9,27,.98)_0%,rgba(5,9,27,.88)_40%,rgba(5,9,27,.5)_72%,rgba(5,9,27,.74)_100%)]" />
        <div className="pointer-events-none absolute -bottom-24 left-[-8%] right-[-8%] h-64 -rotate-3 rounded-[50%] border-t border-violet-500/40 bg-[repeating-radial-gradient(ellipse_at_center,transparent_0_12px,rgba(124,58,237,.11)_13px_14px)] opacity-70" />
        <div className="mx-auto grid min-h-[610px] w-[min(1180px,calc(100%-32px))] grid-cols-1 items-center gap-10 pb-[390px] pt-12 sm:pb-[210px] lg:grid-cols-[.86fr_1.14fr] lg:gap-8 lg:pb-36 lg:pt-8">
          <div className="relative z-10 self-center" data-aos="fade-up">
            <span className="inline-flex rounded-lg border border-violet-500/20 bg-violet-600/10 px-4 py-2 text-[12px] font-semibold tracking-[.08em] text-violet-300 shadow-[0_0_25px_rgba(124,58,237,.12)]">BAG-FREE · AI-ENHANCED EDUCATION</span>
            <h1 className="my-5 max-w-[610px] text-[clamp(42px,4.4vw,64px)] font-black leading-[1.03] tracking-[-.045em]">A Bag-Free School.<br />Where <em className="bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text not-italic text-transparent">Learning Is Light.</em><br />The Future Is <strong className="bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">Bright.</strong></h1>
            <p className="max-w-[580px] text-base leading-7 text-slate-300">The Mentor School is a bag-free school where students carry only a light folder. With minimal homework twice a week, research-based AI assignments and an international-standard curriculum, students learn deeply without carrying the traditional burden.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><a className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 px-6 text-sm font-bold shadow-[0_0_25px_rgba(124,58,237,.38)] transition hover:-translate-y-0.5" href="#enroll">Enroll your child <span className="ml-3 text-xl">→</span></a><a className="inline-flex min-h-12 items-center justify-center rounded-lg border border-violet-300/35 bg-slate-950/30 px-6 text-sm font-bold transition hover:border-violet-400 hover:bg-violet-500/10" href="#why-us">Explore our approach <span className="ml-3 grid h-5 w-5 place-items-center rounded-full bg-violet-500 text-[9px]">▶</span></a></div>
          </div>
          <div className="relative min-h-[350px] self-center sm:min-h-[430px]" data-aos="fade-left">
            <div className="absolute left-[7%] top-[19%] h-[53%] w-[35%] -rotate-[9deg] overflow-hidden rounded-xl border border-violet-300/30 bg-[#080b21] p-2 shadow-[0_20px_55px_rgba(0,0,0,.65),0_0_35px_rgba(124,58,237,.3)]"><img className="h-full w-full rounded-lg object-cover brightness-75 saturate-75" src="/school/student-achievement.webp" alt="A student achievement at The Mentor School" /></div>
            <div className="absolute left-[28%] top-[4%] z-10 h-[71%] w-[50%] -rotate-[9deg] overflow-hidden rounded-xl border border-violet-300/35 bg-[#080b21] p-2 shadow-[0_24px_65px_rgba(0,0,0,.7),0_0_50px_rgba(139,92,246,.35)]"><img className="h-full w-full rounded-lg object-cover brightness-[.78] saturate-75" src="/school/classroom-learning.webp" alt="Students learning at The Mentor School" /></div>
            <div className="absolute right-[2%] top-[23%] z-20 h-[55%] w-[38%] rotate-[5deg] overflow-hidden rounded-xl border border-violet-300/35 bg-[#080b21] p-2 shadow-[0_24px_65px_rgba(0,0,0,.75),0_0_45px_rgba(168,85,247,.38)]"><img className="h-full w-full rounded-lg object-cover brightness-[.72] saturate-75" src="/school/classroom-environment.webp" alt="The Mentor School classroom environment" /></div>
            <div className="absolute bottom-[5%] left-[15%] right-[3%] z-30 h-[9%] -skew-x-[10deg] rounded-[50%] bg-gradient-to-r from-violet-900/10 via-fuchsia-400/80 to-violet-900/10 blur-[2px] shadow-[0_0_30px_rgba(217,70,239,.8)]" />
          </div>
          <div className="absolute inset-x-4 bottom-5 z-20 mx-auto grid max-w-[1180px] grid-cols-1 overflow-hidden rounded-xl border border-violet-300/15 bg-[#080d24]/80 shadow-[0_18px_50px_rgba(0,0,0,.35)] backdrop-blur-xl sm:grid-cols-2 lg:inset-x-0 lg:grid-cols-4">{[["✦","R1–Grade 8","Complete learning journey"],["▣","Bag-free","Purposeful school days"],["⌁","AI-ready","Research-led assignments"],["◆","Global","International curriculum"]].map(([icon,title,text],index)=><span className={`flex min-h-[88px] items-center gap-4 px-5 py-4 ${index<3?"lg:border-r lg:border-violet-300/15":""} ${index<2?"sm:border-b sm:border-violet-300/15 lg:border-b-0":""}`} key={title}><i className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-violet-600/20 text-xl not-italic text-fuchsia-400 shadow-[inset_0_0_16px_rgba(168,85,247,.18)]">{icon}</i><span className="grid"><b className="text-[14px] text-white">{title}</b><small className="mt-1 text-[12px] text-slate-400">{text}</small></span></span>)}</div>
        </div>
      </section>

      <section className="w-full bg-[#070807] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="why-us">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">OUR APPROACH</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">A Smarter Way to <strong className="text-yellow-400">Learn</strong></h2>
        <div className="mx-auto mt-11 grid max-w-[1080px] grid-cols-1 gap-4 md:grid-cols-3">{learning.map(([icon,title,text,image], index)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#111211] p-7 text-left" key={title} data-aos="fade-up" data-aos-delay={index * 90}><img className="-mx-7 -mt-7 mb-6 block h-40 w-[calc(100%_+_3.5rem)] max-w-none object-cover brightness-75 transition group-hover:scale-105 group-hover:brightness-90" src={image} alt="" /><span className="text-3xl text-yellow-400">{icon}</span><h3 className="my-3 text-xl font-bold">{title}</h3><p className="text-sm leading-relaxed text-zinc-400">{text}</p></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">OUR CORE VALUES</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">What We <em className="not-italic text-red-500">Stand For</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Four principles that shape everything we do at The Mentor School.</p>
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map(([icon,title,text,image], index)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#0b0c0b] p-6 text-left" key={title} data-aos="fade-up" data-aos-delay={index * 80}><img className="-mx-6 -mt-6 mb-5 block h-36 w-[calc(100%_+_3rem)] max-w-none object-cover brightness-75 transition group-hover:scale-105" src={image} alt="" /><span className="text-3xl text-yellow-400">{icon}</span><h3 className="my-3 text-lg font-bold">{title}</h3><p className="text-sm leading-relaxed text-zinc-400">{text}</p></article>)}</div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="advantage">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">WHY TMS</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">The TMS <em className="not-italic text-red-500">Advantage</em></h2>
        <div className="mx-auto mt-11 grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{advantages.map(([n,title,text],i)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#111211] p-6 text-left" key={title} data-aos="fade-up" data-aos-delay={(i % 3) * 80}><b className="text-xs tracking-widest text-red-500">{n}</b><h3 className="my-3 text-xl font-bold">{title}</h3><p className="text-sm leading-relaxed text-zinc-400">{text}</p><img className="-mx-6 -mb-6 mt-6 block h-36 w-[calc(100%_+_3rem)] max-w-none object-cover brightness-75 transition group-hover:scale-105" src={["/school/classroom-learning.webp","/landing/global-learning.png","/landing/ai-learning.png","/landing/minimal-homework.jpg","/school/morning-assembly.webp","/school/sports-team.webp"][i]} alt="" /></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24">
        <span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">BEYOND THE CLASSROOM</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Where Students <em className