"use client";

import { useEffect, useState } from "react";
import AOS from "aos";
import VisitorCounter from "./VisitorCounter";
import PublicAdmissionForm from "./PublicAdmissionForm";
import ParentFeedback from "./ParentFeedback";
import SchoolGallery from "./SchoolGallery";
import "aos/dist/aos.css";

const learning = [
  ["▣", "Bag-Free Learning", "All learning materials are provided at school. Students carry only a light folder—no heavy bags.", "/school/classroom-learning.webp"],
  ["◷", "Minimal Homework", "Learning is completed during school hours. Homework is given only twice a week and is research-based.", "/school/classroom-learning.webp"],
  ["⌁", "AI-Enhanced Education", "Students use visual learning and purposeful AI tools to understand concepts that simple teaching cannot.", "/school/real-math-room.jpeg"],
];

const values = [
  ["▣", "Bag-Free Learning", "Students carry only a light folder. All materials are provided at school—no heavy bags or physical strain.", "/school/classroom-learning.webp"],
  ["⌁", "AI-Enhanced Education", "We use AI technology and visual learning to prepare students for a future built on intelligence.", "/school/real-math-room.jpeg"],
  ["◎", "Global Curriculum", "An international-standard model means our students can move anywhere and never feel behind.", "/school/real-classroom.jpeg"],
  ["♡", "Stress-Free Growth", "Minimal homework, research-based learning and a nurturing environment where wellbeing comes first.", "/school/real-garden.jpeg"],
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
  ["English", "UK English", "British subject content builds authentic language, comprehension, writing and confident communication.", "/school/real-reception.jpeg"],
  ["Mathematics", "California Mathematics", "A deep, guided programme connecting mathematics with science, social studies and technology.", "/school/real-math-room.jpeg"],
  ["Science", "UK KS1 · KS2 · KS3", "Accessible, attractive science content that encourages curiosity, participation and practical understanding.", "/school/classroom-learning.webp"],
  ["Computing", "Code Studio", "Block-based coding, digital skills and responsible AI research designed for confident new learners.", "/school/real-math-room.jpeg"],
];

const gradeLevels = [
  ["Reception 1–2", "Discover & communicate", "Play-based language, phonics, early number sense, motor development and confidence-building routines.", ["Early literacy", "Early numeracy", "Creative expression"]],
  ["Grades 1–2", "Build strong foundations", "UK English, California Mathematics and UK KS1 Science taught through visual, guided and practical learning.", ["Reading & writing", "Number fluency", "KS1 discovery"]],
  ["Grades 3–5", "Connect knowledge", "Students deepen comprehension, mathematical reasoning and UK KS2 Science while beginning Code Studio projects and AI research.", ["Independent study", "Integrated projects", "Block coding"]],
  ["Grades 6–8", "Analyse & create", "UK KS3 Science, advanced mathematics, communication and technology projects prepare learners for secondary study and a global future.", ["Critical thinking", "Applied STEM", "Digital fluency"]],
];

const teamGroups = [
  { title: "Management Team", members: [
    ["/team/shahid-hussain-director.webp", "Shahid Hussain", "Director", "", "Guides the school’s direction and development, supporting a welcoming environment where learning, character and student wellbeing come first."],
    ["/team/musswar-hussain-it-director.jpg", "Mussawar Hussain", "IT Director", "", "Oversees school technology and digital systems, supporting practical digital learning and the responsible use of technology across the school."],
  ]},
  { title: "Administration Team", members: [
    ["/team/amna-rasool-principal.webp", "Amna Rasool", "Principal", "Main Campus", "Leads academic and day-to-day school life at Main Campus, supporting teachers, students and families in building a positive learning community."],
    ["/team/iqra-altaf-vice-principal.jpeg", "Iqra Altaf", "Vice Principal", "Main Campus", "Supports academic coordination at Main Campus, working with teachers and students to encourage consistent classroom routines and steady learning progress."],
    ["/team/mishal-maryam.jpeg", "Mishal Maryam", "Principal", "Hadi Campus", "Leads Hadi Campus, supporting teaching, student development and communication with families to create a caring, purposeful school environment."],
    ["/team/tahreem-tariq.jpeg", "Tahreem Tariq", "Admin", "Hadi Campus", "Supports the daily administration of Hadi Campus, helping coordinate school records, parent enquiries and communication between families and staff."],
  ]},
  { title: "Teaching Team", members: [
    ["/team/pakeeza-arshaad.jpeg", "Pakeeza Arshaad", "Primary Teacher", "Hadi Campus", "Supports primary learners at Hadi Campus as they build reading, writing and number skills through clear guidance and engaging classroom activities."],
    ["/team/sajida-parveen.jpeg", "Sajida Parveen", "Math Teacher", "Main Campus", "Helps students at Main Campus develop mathematical understanding, practise problem-solving and build confidence in working with numbers."],
    ["", "Rimsha Taj", "Reception Teacher", "Main Campus", "Guides Reception learners at Main Campus through early language, number and social skills, helping children settle into school with confidence."],
  ]},
  { title: "Technical Team", members: [
    ["", "Muhammad Sajid", "Supervisor", "", "Coordinates day-to-day site support and maintenance needs, helping keep the school environment organised and ready for students and staff."],
    ["", "Muhammad Javid", "Electrician", "", "Supports the upkeep of school electrical systems and equipment, attending to maintenance needs that help classrooms and facilities function smoothly."],
    ["", "Muhammad Nadeem", "Plumbing Maintenance Technician", "", "Maintains plumbing and water facilities, helping address repairs and keep essential school amenities in working order."],
  ]},
];

type PublicDownload = { id:string; title:string; description:string|null; original_name:string; size_bytes:number; campus_name:string|null; published_at:number|null };
type PublicNewsEvent = { id:string; kind:string; title:string; summary:string; event_starts_at:number|null; location:string|null; campus_name:string|null; published_at:number|null };

export default function PublicLandingPage({ signInPath, downloads, newsEvents }: { signInPath: string; downloads: PublicDownload[]; newsEvents: PublicNewsEvent[] }) {
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setMenuOpen(false)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[]);
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
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet-300/30 bg-violet-500/15 text-2xl text-white lg:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="public-mobile-menu" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen ? "×" : "☰"}</button>
        </div>
        {menuOpen && <nav id="public-mobile-menu" className="absolute inset-x-0 top-full grid max-h-[calc(100dvh-68px)] gap-1 overflow-y-auto border-b border-violet-400/25 bg-[#080d24] p-4 shadow-2xl lg:hidden" aria-label="Mobile navigation">{[["#home","Home"],["#why-us","Our Approach"],["#curriculum","Curriculum"],["#life","Photo Gallery"],["#team","Our Team"],["#downloads","Downloads"],["#news-events","News & Events"],["#campus","Contact"],["#enroll","Apply for admission"],[signInPath,"Dashboard"]].map(([href,label])=><a key={href} className="rounded-lg px-4 py-3 text-sm text-white hover:bg-violet-500/20" href={href} onClick={()=>setMenuOpen(false)}>{label}</a>)}</nav>}
      </header>

      <section className="relative isolate w-full overflow-hidden bg-[#05091b]" id="home">
        <img className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-65" src="/school/real-building.jpeg" alt="" aria-hidden="true" />
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
            <div className="absolute left-[7%] top-[19%] h-[53%] w-[35%] -rotate-[9deg] overflow-hidden rounded-xl border border-violet-300/30 bg-[#080b21] p-2 shadow-[0_20px_55px_rgba(0,0,0,.65),0_0_35px_rgba(124,58,237,.3)]"><img className="h-full w-full rounded-lg object-cover brightness-75 saturate-75" src="/school/real-student-leaders.jpeg" alt="A student achievement at The Mentor School" /></div>
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
        <div className="mx-auto mt-11 grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{advantages.map(([n,title,text],i)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#111211] p-6 text-left" key={title} data-aos="fade-up" data-aos-delay={(i % 3) * 80}><b className="text-xs tracking-widest text-red-500">{n}</b><h3 className="my-3 text-xl font-bold">{title}</h3><p className="text-sm leading-relaxed text-zinc-400">{text}</p><img className="-mx-6 -mb-6 mt-6 block h-36 w-[calc(100%_+_3rem)] max-w-none object-cover brightness-75 transition group-hover:scale-105" src={["/school/classroom-learning.webp","/school/real-classroom.jpeg","/school/real-math-room.jpeg","/school/classroom-learning.webp","/school/morning-assembly.webp","/school/real-sports.jpeg"][i]} alt="" /></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24">
        <span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">BEYOND THE CLASSROOM</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Where Students <em className="not-italic text-red-500">Thrive</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Confidence grows when children learn, create, play and belong.</p>
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-2">{[["/school/real-sports.jpeg","Sports & teamwork","Healthy bodies. Stronger friendships."],["/school/real-student-leaders.jpeg","Student achievement","Confidence built through participation."],["/school/food-festival.webp","School community","Moments children remember."]].map(([image,title,text],index)=><figure className={`group relative min-h-60 overflow-hidden rounded-2xl border border-white/15 ${index===0?"md:row-span-2 md:min-h-[500px]":""}`} key={title} data-aos="fade-up"><img className="absolute inset-0 h-full w-full object-cover brightness-75 transition duration-500 group-hover:scale-105 group-hover:brightness-90" src={image} alt={title}/><figcaption className="absolute inset-x-0 bottom-0 grid bg-gradient-to-t from-black via-black/75 to-transparent p-6 pt-20 text-left"><b className="text-xl">{title}</b><span className="text-sm text-zinc-300">{text}</span></figcaption></figure>)}</div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="curriculum">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">BUILT FOR THE WORLD</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">International-Standard <em className="not-italic text-red-500">Courses</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Trusted learning approaches, thoughtfully adapted for our students.</p>
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{courses.map(([title,badge,text,image], index)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#111211] p-6 text-left" key={title} data-aos="fade-up" data-aos-delay={index * 80}><img className="-mx-6 -mt-6 mb-5 block h-36 w-[calc(100%_+_3rem)] max-w-none object-cover brightness-75 transition group-hover:scale-105" src={image} alt="" /><span className="text-[11px] font-extrabold uppercase tracking-wide text-yellow-400">{badge}</span><h3 className="my-3 text-xl font-bold">{title}</h3><p className="min-h-24 text-sm leading-relaxed text-zinc-400">{text}</p><a className="mt-5 inline-flex text-sm font-bold text-red-500 hover:text-yellow-400" href="#enroll">Explore learning →</a></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="life">
        <span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">EVERY DAY COUNTS</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Life at <em className="not-italic text-red-500">TMS</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Rich school days filled with learning, friendship, movement and creativity.</p>
        <SchoolGallery />
      </section>

      <section className="w-full bg-[#080908] px-5 py-24 text-center lg:px-[max(calc((100vw-1140px)/2),30px)] lg:py-28" id="team">
        <span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">OUR FACULTY</span>
        <h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Meet Our <em className="not-italic text-red-500">Team</em></h2>
        {teamGroups.map((group) => <div className="mx-auto mt-16 max-w-[1140px]" key={group.title}>
          <h3 className="mb-24 text-2xl font-black uppercase tracking-wide text-white">{group.title}</h3>
          <div className={`mx-auto grid grid-cols-1 gap-x-6 gap-y-24 sm:grid-cols-2 ${group.members.length === 2 ? "max-w-[560px]" : group.members.length === 3 ? "max-w-[850px] lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {group.members.map(([image,name,designation,campus,bio],index)=><article className="flex min-h-[390px] flex-col rounded-[26px] border border-white/15 bg-[#131513] shadow-2xl" key={name} data-aos="zoom-in" data-aos-delay={index * 90}>
              <div className="z-10 mx-auto -mt-14 h-[154px] w-[154px] shrink-0 rounded-full border-[3px] border-yellow-400 bg-gradient-to-br from-red-600 to-yellow-400 p-1.5 shadow-xl">
                {image ? <img className="h-full w-full rounded-full bg-zinc-100 object-cover object-top" src={image} alt={`${name}, ${designation}${campus ? ` at ${campus}` : ""}`} loading="lazy" /> : <div className="grid h-full w-full place-content-center rounded-full bg-[#202420] text-3xl font-bold text-yellow-400" aria-label={`Photo to follow for ${name}`}>{name.split(" ").map(part=>part[0]).join("")}</div>}
              </div>
              <div className="flex flex-1 flex-col px-6 py-7"><h4 className="text-xl font-black uppercase">{name}</h4><p className="mt-1 text-[12px] font-extrabold uppercase tracking-wider text-yellow-400">{designation}</p>{campus && <small className="mt-6 text-[14px] leading-relaxed text-zinc-400">{campus}</small>}<p className="mt-5 text-[14px] leading-relaxed text-zinc-400">{bio}</p></div>
            </article>)}
          </div>
        </div>)}
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-8 lg:py-24">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">TRUSTED BY FAMILIES</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">What Parents & <em className="not-italic text-red-500">Students</em> Say</h2>
        <ParentFeedback />
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-[max(calc((100vw-1160px)/2),30px)] lg:py-24">
        <div className="mx-auto mb-11 max-w-3xl"><span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">A CONNECTED JOURNEY</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Our <em className="not-italic text-red-500">Curriculum</em> by Grade Level</h2><p className="text-zinc-400">From Reception to Grade 8, each stage strengthens the skills needed for what comes next.</p></div>
        <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 text-left md:grid-cols-2 lg:grid-cols-4">{gradeLevels.map(([level,title,description,skills], index)=><article className="relative rounded-2xl border border-white/15 bg-gradient-to-br from-[#151715] to-[#0b0c0b] p-6 before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-red-600 before:to-yellow-400" key={level as string} data-aos="fade-up" data-aos-delay={index * 80}><span className="text-[10px] font-black tracking-[.14em] text-red-500">STAGE {index + 1}</span><h3 className="mt-3 text-xl font-bold">{level as string}</h3><h4 className="mb-4 mt-1 text-xs font-extrabold uppercase text-yellow-400">{title as string}</h4><p className="text-sm leading-relaxed text-zinc-400">{description as string}</p><ul className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-xs text-zinc-300">{(skills as string[]).map(skill=><li key={skill}>✓ {skill}</li>)}</ul></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="news-events">
        <div className="mx-auto max-w-[1100px] text-center"><span className="inline-flex rounded-full border border-fuchsia-400/50 px-3 py-1.5 text-xs font-extrabold text-fuchsia-300">SCHOOL UPDATES</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">News &amp; <em className="not-italic text-fuchsia-400">Events</em></h2><p className="mx-auto max-w-2xl text-[15px] text-zinc-400">Latest announcements and upcoming activities from our campuses.</p></div>
        <div className="mx-auto mt-10 grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{newsEvents.length ? newsEvents.map((item,index)=><article className="rounded-2xl border border-white/15 bg-[#0b0c0b] p-6 text-left" key={item.id} data-aos="fade-up" data-aos-delay={index*60}><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-violet-500/15 px-3 py-1 text-[12px] font-bold uppercase text-violet-300">{item.kind}</span><small className="text-[12px] text-zinc-500">{item.campus_name ?? "All campuses"}</small></div><h3 className="mt-5 text-xl font-bold">{item.title}</h3><p className="mt-3 text-[14px] leading-relaxed text-zinc-400">{item.summary}</p>{item.event_starts_at && <p className="mt-5 border-t border-white/10 pt-4 text-[13px] font-semibold text-yellow-400">📅 {new Date(item.event_starts_at).toLocaleString("en-PK",{dateStyle:"medium",timeStyle:"short"})}</p>}{item.location && <p className="mt-2 text-[13px] text-zinc-400">📍 {item.location}</p>}</article>) : <div className="col-span-full rounded-2xl border border-dashed border-white/15 bg-[#0b0c0b] p-10 text-center text-zinc-400">News and upcoming events will be published here.</div>}</div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="downloads">
        <div className="mx-auto max-w-[1100px] text-center"><span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">PUBLIC RESOURCES</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">School <em className="not-italic text-red-500">Downloads</em></h2><p className="mx-auto max-w-2xl text-[15px] text-zinc-400">Forms, notices and useful documents shared by The Mentor School.</p></div>
        <div className="mx-auto mt-10 grid max-w-[900px] gap-3">{downloads.length ? downloads.map(item=><article className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-[#111211] p-5 sm:flex-row sm:items-center" key={item.id}><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-600/15 text-xl text-red-400">⬇</span><div className="min-w-0 flex-1"><h3 className="font-bold text-white">{item.title}</h3><p className="mt-1 text-[13px] text-zinc-400">{item.description || item.original_name}</p><small className="mt-2 block text-[12px] text-zinc-500">{item.campus_name ?? "All campuses"} · {Math.max(1,Math.ceil(item.size_bytes/1024))} KB</small></div><a className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-sm font-bold text-white" href={`/api/public-downloads/${item.id}`}>Download</a></article>) : <div className="rounded-2xl border border-dashed border-white/15 bg-[#111211] p-10 text-center text-zinc-400">Public downloads will appear here when they are published.</div>}</div>
      </section>

      <section className="grid w-full grid-cols-1 gap-5 bg-[#101110] px-5 py-20 lg:grid-cols-[1.2fr_.8fr] lg:px-[max(calc((100vw-1160px)/2),30px)] lg:py-24" id="campus">
        <div className="min-h-72 overflow-hidden rounded-2xl border border-white/15"><img className="h-full w-full object-cover" src="/school/school-exterior.webp" alt="The Mentor School campus in Adda Machiwal" /></div>
        <div className="rounded-2xl border border-white/15 bg-[#0b0c0b] p-7 text-left md:p-12"><span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">THE MENTOR SCHOOL · MAIN CAMPUS</span><h2 className="my-3 text-[clamp(36px,4vw,50px)] font-black tracking-[-.045em]">Visit Our <em className="not-italic text-red-500">Main Campus</em></h2><p className="text-zinc-400">See our learning environment, meet the team and discover whether The Mentor School is right for your child.</p><ul className="my-7 grid gap-4">{[["Address","1 KM, Chak No. 557/E.B Road, Adda Machiwal, 61070, Tehsil & District Vehari, Punjab, Pakistan",""],["Phone & WhatsApp","0301 0763122","https://wa.me/923010763122"],["Email","thementorschool.info@gmail.com","mailto:thementorschool.info@gmail.com"],["Website","www.thementorschools.com","https://www.thementorschools.com"]].map(([label,value,href])=><li className="grid border-b border-white/10 pb-3" key={label}><b className="text-[11px] uppercase tracking-widest text-yellow-400">{label}</b>{href?<a className="break-words text-zinc-200 hover:text-yellow-400" href={href}>{value}</a>:<span className="text-zinc-200">{value}</span>}</li>)}</ul><div className="flex flex-wrap gap-5 text-sm font-bold text-red-500"><a href="#enroll">Plan your visit →</a><a href="https://www.facebook.com/tms.mentor/" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.youtube.com/@thementorschoolmachianwala8141" target="_blank" rel="noreferrer">YouTube</a></div></div>
      </section>

      <section className="grid w-full grid-cols-1 gap-5 bg-[#080908] px-5 pb-20 lg:grid-cols-[.8fr_1.2fr] lg:px-[max(calc((100vw-1160px)/2),30px)] lg:pb-24" aria-labelledby="hadi-campus-heading">
        <div className="rounded-2xl border border-white/15 bg-[#0b0c0b] p-7 text-left md:p-12"><span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">THE MENTOR SCHOOL · HADI CAMPUS</span><h2 className="my-3 text-[clamp(36px,4vw,50px)] font-black tracking-[-.045em]" id="hadi-campus-heading">Welcome to <em className="not-italic text-red-500">Hadi Campus</em></h2><p className="text-zinc-400">A welcoming TMS campus serving families in Machiwal with the same commitment to meaningful learning and student growth.</p><ul className="my-7 grid gap-4">{[["Address","4 Bazar Bangla, Road Machiwal, Vehari, Punjab, Pakistan",""],["Phone & WhatsApp","0327 8105701","https://wa.me/923278105701"],["Email","tms.hadicamus@gmail.com","mailto:tms.hadicamus@gmail.com"],["Website","www.thementorschools.com","https://www.thementorschools.com"]].map(([label,value,href])=><li className="grid border-b border-white/10 pb-3" key={label}><b className="text-[11px] uppercase tracking-widest text-yellow-400">{label}</b>{href?<a className="break-words text-zinc-200 hover:text-yellow-400" href={href}>{value}</a>:<span className="text-zinc-200">{value}</span>}</li>)}</ul><div className="flex flex-wrap gap-5 text-sm font-bold text-red-500"><a href="https://wa.me/923278105701" target="_blank" rel="noreferrer">Contact Hadi Campus →</a><a href="#enroll">Start admission</a></div></div>
        <div className="order-first min-h-80 overflow-hidden rounded-2xl border border-white/15 lg:order-last"><img className="h-full w-full object-cover" src="/school/hadi-campus.png" alt="The Mentor School Hadi Campus building in Machiwal" /></div>
      </section>

      <section className="w-full bg-[#080908] px-5 pb-20 lg:px-[max(calc((100vw-1100px)/2),30px)]" aria-labelledby="campus-map-heading">
        <h2 id="campus-map-heading" className="mb-6 text-3xl font-black">Campus Maps</h2>
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#131513]">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6"><h3 className="text-xl font-bold">Main Campus</h3><a className="text-sm font-bold text-yellow-400" href="https://www.google.com/maps/search/?api=1&amp;query=30.1125978%2C72.5228161" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a></div>
          <iframe title="The Mentor School Main Campus map" src="https://maps.google.com/maps?q=30.1125978,72.5228161&amp;z=16&amp;output=embed" className="h-[360px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-8 lg:py-24"><span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">EDUCATION FOR LIFE</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Built for a <em className="not-italic text-red-500">Global Future</em></h2><p className="text-zinc-400">Strong roots. Open minds. Skills for a changing world.</p><div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">{[["Values","Respect, responsibility, integrity and Islamic character guide everyday choices. Students practise kindness, discipline and service throughout school life."],["Knowledge","Strong foundations in English, mathematics, science, languages and faith help students connect ideas, understand concepts and keep progressing confidently."],["Skills","Communication, collaboration, creativity, problem-solving and responsible technology use prepare learners to adapt, contribute and lead in a changing world."]].map(([title,text])=><article className="grid min-h-48 content-start rounded-2xl border border-white/15 bg-[#111211] p-7"><b className="text-xl text-yellow-400">{title}</b><span className="mt-4 text-[15px] leading-relaxed text-zinc-400">{text}</span></article>)}</div></section>

      <section className="relative w-full overflow-hidden bg-gradient-to-br from-red-950 via-[#111211] to-yellow-950 px-5 py-24 text-center" id="enroll"><span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">START THEIR JOURNEY</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Enroll Your Child <em className="not-italic text-red-500">Today</em></h2><p className="text-zinc-300">Give your child a lighter school day and a brighter path forward.</p><div className="mx-auto mt-7 flex max-w-md flex-col justify-center gap-3 sm:flex-row"><a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-extrabold hover:bg-red-500" href="#admission-form">Begin online admission</a><a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 bg-white/5 px-5 text-sm font-extrabold hover:border-yellow-400 hover:text-yellow-400" href="tel:+923010763122">Call 0301 0763122</a></div><div id="admission-form" className="scroll-mt-24"><PublicAdmissionForm /></div></section>

      <section className="w-full border-t border-violet-300/15 bg-[#080d24] px-5 py-16 lg:px-[max(calc((100vw-1000px)/2),30px)]" aria-labelledby="developer-heading">
        <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-7 rounded-3xl border border-violet-300/15 bg-[#070b20] p-7 text-center shadow-[0_24px_70px_rgba(0,0,0,.25)] sm:flex-row sm:text-left md:p-9" data-aos="fade-up">
          <img className="h-28 w-28 shrink-0 rounded-2xl border-2 border-violet-400/50 object-cover object-top shadow-[0_0_30px_rgba(139,92,246,.24)]" src="/team/musswar-hussain-it-director.jpg" alt="Mussawar Hussain, developer of The Mentor School application" />
          <div className="flex-1"><span className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-300">Designed &amp; Developed By</span><h2 className="mt-2 text-3xl font-black text-white" id="developer-heading">Mussawar Hussain</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">Educationist and IT expert with more than 10 years of experience creating school systems and practical digital-learning solutions.</p></div>
          <a className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 px-6 text-sm font-bold text-white shadow-[0_0_24px_rgba(124,58,237,.35)] transition hover:-translate-y-0.5" href="https://mussawarhussain.github.io/portfolio/" target="_blank" rel="noreferrer">View Portfolio <span className="ml-2">↗</span></a>
        </div>
      </section>

      <footer className="grid w-full grid-cols-1 items-center gap-5 border-t border-white/10 bg-[#050605] px-5 py-10 text-sm text-zinc-400 md:grid-cols-2 lg:px-[max(calc((100vw-1100px)/2),30px)]"><div className="flex items-center gap-3"><img className="h-14 w-12 object-contain" src="/tms-original-logo-transparent.png" alt="The Mentor School logo"/><div className="grid"><b className="text-lg text-white">The Mentor School</b><small>Education for life</small></div></div><p className="md:text-right"><a className="hover:text-yellow-400" href="mailto:thementorschool.info@gmail.com">thementorschool.info@gmail.com</a><br/><a className="hover:text-yellow-400" href="tel:+923010763122">0301 0763122</a> · Adda Machiwal, Vehari</p><nav className="flex flex-wrap gap-5"><a href="#why-us">Why TMS</a><a href="#curriculum">Curriculum</a><a href="#life">School life</a><a href="#team">Our team</a><a href="https://www.facebook.com/tms.mentor/" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.youtube.com/@thementorschoolmachianwala8141" target="_blank" rel="noreferrer">YouTube</a></nav><small className="md:text-right">© {new Date().getFullYear()} The Mentor School. All rights reserved.</small><VisitorCounter /></footer>
      <button type="button" className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-violet-300/40 bg-violet-700 text-2xl text-white shadow-xl hover:bg-violet-600" aria-label="Back to top" title="Back to top" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}>↑</button>
    </main>
  );
}
