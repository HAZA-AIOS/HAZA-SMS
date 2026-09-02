"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

const learning = [
  ["▣", "Bag-Free Learning", "All learning materials are provided at school. Students carry only a light folder—no heavy bags.", "/school/classroom-environment.webp"],
  ["◷", "Minimal Homework", "Learning is completed during school hours. Homework is given only twice a week and is research-based.", "/school/student-assessment.webp"],
  ["⌁", "AI-Enhanced Education", "Students use visual learning and purposeful AI tools to understand concepts that simple teaching cannot.", "/school/classroom-learning.webp"],
];

const values = [
  ["▣", "Bag-Free Learning", "Students carry only a light folder. All materials are provided at school—no heavy bags or physical strain.", "/school/classroom-environment.webp"],
  ["⌁", "AI-Enhanced Education", "We use AI technology and visual learning to prepare students for a future built on intelligence.", "/school/student-achievement.webp"],
  ["◎", "Global Curriculum", "An international-standard model means our students can move anywhere and never feel behind.", "/school/examination-day.webp"],
  ["♡", "Stress-Free Growth", "Minimal homework, research-based learning and a nurturing environment where wellbeing comes first.", "/school/outdoor-activities.webp"],
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
  ["English", "UK English", "British subject content builds authentic language, comprehension, writing and confident communication.", "/school/classroom-learning.webp"],
  ["Mathematics", "California Mathematics", "A deep, guided programme connecting mathematics with science, social studies and technology.", "/school/student-assessment.webp"],
  ["Science", "UK KS1 · KS2 · KS3", "Accessible, attractive science content that encourages curiosity, participation and practical understanding.", "/school/outdoor-activities.webp"],
  ["Computing", "Code Studio", "Block-based coding, digital skills and responsible AI research designed for confident new learners.", "/school/student-achievement.webp"],
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

export default function PublicLandingPage({ signInPath }: { signInPath: string }) {
  useEffect(() => {
    AOS.init({ duration: 700, easing: "ease-out-cubic", once: true, offset: 70 });
    return () => AOS.refreshHard();
  }, []);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#080908] font-sans text-white selection:bg-red-600 selection:text-white">
      <header className="sticky top-0 z-50 h-[54px] w-full border-b border-white/10 bg-[#0b0c0b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-full w-[min(1220px,calc(100%-40px))] items-center gap-4">
          <a href="#home" className="mr-auto flex items-center gap-2.5" aria-label="The Mentor School home">
            <img className="h-9 w-8 object-contain" src="/tms-original-logo-transparent.png" alt="The Mentor School original logo" />
            <span className="leading-none"><b className="text-[15px] font-extrabold">The Mentor <em className="not-italic text-red-500">School</em></b></span>
          </a>
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Main navigation">
            {[["#home","Home"],["#why-us","Our Approach"],["#advantage","Why TMS"],["#curriculum","Curriculum"],["#life","Gallery"],["#team","Our Team"],["#campus","Contact"]].map(([href,label])=><a className="text-[13px] font-semibold text-zinc-300 transition hover:text-yellow-400" href={href} key={href}>{label}</a>)}
          </nav>
          <a className="hidden border-l border-white/15 pl-4 text-[13px] font-semibold text-zinc-300 transition hover:text-white md:block" href={signInPath}>Dashboard</a>
          <a className="inline-flex min-h-9 items-center justify-center rounded-lg bg-red-600 px-4 text-[13px] font-extrabold text-white transition hover:bg-red-500" href="#enroll">Enroll Now</a>
        </div>
      </header>

      <section className="w-full bg-[radial-gradient(circle_at_12%_10%,rgba(255,23,23,.18),transparent_30%),radial-gradient(circle_at_88%_15%,rgba(224,182,0,.17),transparent_31%),linear-gradient(135deg,#1a090e,#080908_44%,#151004)] p-3 sm:p-5 lg:p-9" id="home">
        <div className="relative mx-auto grid min-h-[620px] w-full max-w-[1280px] grid-cols-1 items-center gap-10 overflow-hidden rounded-3xl border border-white/20 bg-[radial-gradient(circle_at_70%_42%,rgba(121,17,38,.28),transparent_34%),linear-gradient(135deg,#101210,#090a09_58%,#171008)] px-6 pb-40 pt-12 shadow-2xl ring-[5px] ring-white/5 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:px-16 lg:pb-28 lg:pt-16">
          <div className="self-center" data-aos="fade-up">
            <span className="inline-flex rounded-full border border-red-500/60 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-red-500">BAG-FREE · AI-ENHANCED EDUCATION</span>
            <h1 className="my-5 max-w-[650px] text-[clamp(45px,5vw,74px)] font-black leading-[.98] tracking-[-.05em]">A Bag-Free School.<br />Where <em className="not-italic text-red-500">Learning Is Light.</em><br />The Future Is <strong className="text-yellow-400">Bright.</strong></h1>
            <p className="max-w-[620px] text-base leading-relaxed text-zinc-300">The Mentor School is a bag-free school where students carry only a light folder. With minimal homework twice a week, research-based AI assignments and an international-standard curriculum, students learn deeply without carrying the traditional burden.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-extrabold transition hover:bg-red-500" href="#enroll">Enroll your child</a><a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 bg-white/5 px-5 text-sm font-extrabold transition hover:border-yellow-400 hover:text-yellow-400" href="#why-us">Explore our approach</a></div>
          </div>
          <div className="relative min-h-[355px] self-center sm:min-h-[430px]" data-aos="fade-left">
            <figure className="absolute right-0 top-2 h-[310px] w-[68%] overflow-hidden rounded-[70px_18px_70px_18px] border border-white/20 bg-zinc-900 shadow-2xl sm:h-[390px] sm:w-[62%]"><img className="h-full w-full object-cover brightness-[.85] saturate-90" src="/school/classroom-learning.webp" alt="Students learning at The Mentor School" /></figure>
            <figure className="absolute left-0 top-16 h-[220px] w-[52%] overflow-hidden rounded-[18px_62px_18px_62px] border border-white/20 bg-zinc-900 shadow-2xl sm:h-[285px] sm:w-[47%]"><img className="h-full w-full object-cover brightness-[.85] saturate-90" src="/school/student-achievement.webp" alt="A student achievement at The Mentor School" /></figure>
            <div className="absolute bottom-0 left-[5%] z-10 flex min-w-[250px] items-center gap-3 rounded-xl border border-yellow-400/50 bg-black/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:bottom-3 sm:left-[17%] sm:min-w-[285px]"><img className="h-11 w-10 object-contain" src="/tms-original-logo-transparent.png" alt="" /><span className="grid"><b className="text-sm">Education for life</b><small className="text-[11px] text-yellow-400">Bag-free · visual · future-ready</small></span></div>
          </div>
          <div className="absolute inset-x-6 bottom-6 grid grid-cols-2 gap-y-4 border-t border-white/15 pt-4 lg:inset-x-16 lg:grid-cols-4">{[["R1–Grade 8","Complete learning journey"],["Bag-free","Purposeful school days"],["AI-ready","Research-led assignments"],["Global","International curriculum"]].map(([title,text],index)=><span className={`grid px-3 ${index%2===0?"border-r border-white/15":""} lg:border-r lg:last:border-r-0`} key={title}><b className="text-sm text-white">{title}</b><small className="text-[11px] text-zinc-500">{text}</small></span>)}</div>
        </div>
      </section>

      <section className="w-full bg-[#070807] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="why-us">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">OUR APPROACH</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">A Smarter Way to <strong className="text-yellow-400">Learn</strong></h2>
        <div className="mx-auto mt-11 grid max-w-[1080px] grid-cols-1 gap-4 md:grid-cols-3">{learning.map(([icon,title,text,image], index)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#111211] p-7 text-left" key={title} data-aos="fade-up" data-aos-delay={index * 90}><img className="-mx-7 -mt-7 mb-6 h-40 w-[calc(100%+56px)] object-cover brightness-75 transition group-hover:scale-105 group-hover:brightness-90" src={image} alt="" /><span className="text-3xl text-yellow-400">{icon}</span><h3 className="my-3 text-xl font-bold">{title}</h3><p className="text-sm leading-relaxed text-zinc-400">{text}</p></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">OUR CORE VALUES</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">What We <em className="not-italic text-red-500">Stand For</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Four principles that shape everything we do at The Mentor School.</p>
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map(([icon,title,text,image], index)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#0b0c0b] p-6 text-left" key={title} data-aos="fade-up" data-aos-delay={index * 80}><img className="-mx-6 -mt-6 mb-5 h-36 w-[calc(100%+48px)] object-cover brightness-75 transition group-hover:scale-105" src={image} alt="" /><span className="text-3xl text-yellow-400">{icon}</span><h3 className="my-3 text-lg font-bold">{title}</h3><p className="text-sm leading-relaxed text-zinc-400">{text}</p></article>)}</div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="advantage">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">WHY TMS</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">The TMS <em className="not-italic text-red-500">Advantage</em></h2>
        <div className="mx-auto mt-11 grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{advantages.map(([n,title,text],i)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#111211] p-6 text-left" key={title} data-aos="fade-up" data-aos-delay={(i % 3) * 80}><b className="text-xs tracking-widest text-red-500">{n}</b><h3 className="my-3 text-xl font-bold">{title}</h3><p className="text-sm leading-relaxed text-zinc-400">{text}</p><img className="-mx-6 -mb-6 mt-6 h-36 w-[calc(100%+48px)] object-cover brightness-75 transition group-hover:scale-105" src={["/school/classroom-environment.webp","/school/campus-walkway.webp","/school/campus-ground.webp","/school/student-assessment.webp","/school/school-exterior.webp","/school/sports-team.webp"][i]} alt="" /></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24">
        <span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">BEYOND THE CLASSROOM</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Where Students <em className="not-italic text-red-500">Thrive</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Confidence grows when children learn, create, play and belong.</p>
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-2">{[["/school/sports-team.webp","Sports & teamwork","Healthy bodies. Stronger friendships."],["/school/student-achievement.webp","Student achievement","Confidence built through participation."],["/school/food-festival.webp","School community","Moments children remember."]].map(([image,title,text],index)=><figure className={`group relative min-h-60 overflow-hidden rounded-2xl border border-white/15 ${index===0?"md:row-span-2 md:min-h-[500px]":""}`} key={title} data-aos="fade-up"><img className="absolute inset-0 h-full w-full object-cover brightness-75 transition duration-500 group-hover:scale-105 group-hover:brightness-90" src={image} alt={title}/><figcaption className="absolute inset-x-0 bottom-0 grid bg-gradient-to-t from-black via-black/75 to-transparent p-6 pt-20 text-left"><b className="text-xl">{title}</b><span className="text-sm text-zinc-300">{text}</span></figcaption></figure>)}</div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="curriculum">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">BUILT FOR THE WORLD</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">International-Standard <em className="not-italic text-red-500">Courses</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Trusted learning approaches, thoughtfully adapted for our students.</p>
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{courses.map(([title,badge,text,image], index)=><article className="group overflow-hidden rounded-2xl border border-white/15 bg-[#111211] p-6 text-left" key={title} data-aos="fade-up" data-aos-delay={index * 80}><img className="-mx-6 -mt-6 mb-5 h-36 w-[calc(100%+48px)] object-cover brightness-75 transition group-hover:scale-105" src={image} alt="" /><span className="text-[11px] font-extrabold uppercase tracking-wide text-yellow-400">{badge}</span><h3 className="my-3 text-xl font-bold">{title}</h3><p className="min-h-24 text-sm leading-relaxed text-zinc-400">{text}</p><a className="mt-5 inline-flex text-sm font-bold text-red-500 hover:text-yellow-400" href="#enroll">Explore learning →</a></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-[max(calc((100vw-1100px)/2),30px)] lg:py-24" id="life">
        <span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">EVERY DAY COUNTS</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Life at <em className="not-italic text-red-500">TMS</em></h2><p className="mx-auto mb-11 max-w-2xl text-[15px] text-zinc-400">Rich school days filled with learning, friendship, movement and creativity.</p>
        <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-2">{[["/school/school-event.webp","A colorful outdoor event at The Mentor School"],["/school/morning-assembly.webp","Students participating in the morning assembly"],["/school/examination-day.webp","Students completing an assessment"],["/school/outdoor-activities.webp","Students taking part in outdoor activities"]].map(([image,alt],index)=><img className={`h-52 w-full rounded-xl border border-white/15 object-cover brightness-80 transition hover:brightness-100 ${index===0?"col-span-2 row-span-2 h-full min-h-[430px]":""}`} src={image} alt={alt} key={image} data-aos="zoom-in"/> )}</div>
        <div className="mx-auto mt-4 grid max-w-[1100px] grid-cols-1 gap-3 md:grid-cols-3">{[["/school/campus-walkway.webp","Green campus"],["/school/classroom-environment.webp","Prepared classrooms"],["/school/student-assessment.webp","Focused learning"]].map(([image,title])=><figure className="group relative h-52 overflow-hidden rounded-xl border border-white/15" key={title}><img className="h-full w-full object-cover brightness-75 transition group-hover:scale-105" src={image} alt={title}/><figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-4 pt-12 text-left font-bold">{title}</figcaption></figure>)}</div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-24 text-center lg:px-[max(calc((100vw-1140px)/2),30px)] lg:py-28" id="team">
        <span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">OUR FACULTY</span>
        <h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Meet the <em className="not-italic text-red-500">Educators</em></h2>
        <p className="mx-auto mb-20 max-w-2xl text-[15px] text-zinc-400">Passionate, qualified and dedicated to nurturing every student’s potential—the team behind The Mentor School.</p>
        <div className="mx-auto grid max-w-[1140px] grid-cols-1 gap-x-6 gap-y-24 sm:grid-cols-2 lg:grid-cols-4">{teamGroups.map(([image,name,designation,bio],index)=><article className="flex min-h-[450px] flex-col rounded-[26px] border border-white/15 bg-[#131513] shadow-2xl" key={name} data-aos="zoom-in" data-aos-delay={index * 90}><div className="z-10 mx-auto -mt-14 h-[154px] w-[154px] shrink-0 rounded-full border-[3px] border-yellow-400 bg-gradient-to-br from-red-600 to-yellow-400 p-1.5 shadow-xl"><img className="h-full w-full rounded-full bg-zinc-100 object-cover object-top" src={image} alt={`${name}, ${designation} at The Mentor School`} /></div><div className="flex flex-1 flex-col px-6 py-6"><h3 className="text-xl font-black uppercase">{name}</h3><p className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-yellow-400">{designation}</p><small className="mt-6 text-[13px] leading-relaxed text-zinc-400">{bio}</small></div><div className="flex h-14 items-center justify-center gap-3 rounded-b-[25px] bg-gradient-to-r from-red-700 via-red-600 to-yellow-600">{[["https://www.thementorschools.com","W","The Mentor School website"],["https://www.facebook.com/tms.mentor/","f","The Mentor School on Facebook"],["https://www.youtube.com/@thementorschoolmachianwala8141","▶","The Mentor School on YouTube"]].map(([href,label,aria])=><a className="grid h-8 w-8 place-items-center rounded-full border border-white/60 bg-white text-xs font-black text-zinc-900 transition hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-white" href={href} target="_blank" rel="noreferrer" aria-label={aria} key={href}>{label}</a>)}</div></article>)}</div>
      </section>

      <section className="w-full bg-[#101110] px-5 py-20 text-center lg:px-8 lg:py-24">
        <span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">TRUSTED BY FAMILIES</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">What Parents & <em className="not-italic text-red-500">Students</em> Say</h2>
        <blockquote className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/15 bg-[#0b0c0b] p-8 text-left shadow-xl md:p-12"><span className="text-6xl leading-none text-yellow-400">“</span><p className="text-lg leading-relaxed text-zinc-200">The difference is visible in confidence, curiosity and the way children talk about their school day. Learning feels meaningful and they are excited to return.</p><footer className="mt-7 grid"><b>A TMS parent</b><small className="text-zinc-500">The Mentor School community</small></footer></blockquote>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-[max(calc((100vw-1160px)/2),30px)] lg:py-24">
        <div className="mx-auto mb-11 max-w-3xl"><span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">A CONNECTED JOURNEY</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Our <em className="not-italic text-red-500">Curriculum</em> by Grade Level</h2><p className="text-zinc-400">From Reception to Grade 8, each stage strengthens the skills needed for what comes next.</p></div>
        <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 text-left md:grid-cols-2 lg:grid-cols-4">{gradeLevels.map(([level,title,description,skills], index)=><article className="relative rounded-2xl border border-white/15 bg-gradient-to-br from-[#151715] to-[#0b0c0b] p-6 before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-red-600 before:to-yellow-400" key={level as string} data-aos="fade-up" data-aos-delay={index * 80}><span className="text-[10px] font-black tracking-[.14em] text-red-500">STAGE {index + 1}</span><h3 className="mt-3 text-xl font-bold">{level as string}</h3><h4 className="mb-4 mt-1 text-xs font-extrabold uppercase text-yellow-400">{title as string}</h4><p className="text-sm leading-relaxed text-zinc-400">{description as string}</p><ul className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-xs text-zinc-300">{(skills as string[]).map(skill=><li key={skill}>✓ {skill}</li>)}</ul></article>)}</div>
      </section>

      <section className="grid w-full grid-cols-1 gap-5 bg-[#101110] px-5 py-20 lg:grid-cols-[1.2fr_.8fr] lg:px-[max(calc((100vw-1160px)/2),30px)] lg:py-24" id="campus">
        <div className="min-h-72 overflow-hidden rounded-2xl border border-white/15"><img className="h-full w-full object-cover" src="/school/school-exterior.webp" alt="The Mentor School campus in Adda Machiwal" /></div>
        <div className="rounded-2xl border border-white/15 bg-[#0b0c0b] p-7 text-left md:p-12"><span className="inline-flex rounded-full border border-red-500/50 px-3 py-1.5 text-xs font-extrabold text-red-500">WELCOME TO OUR SCHOOL</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Visit Our <em className="not-italic text-red-500">Campus</em></h2><p className="text-zinc-400">See our learning environment, meet the team and discover whether The Mentor School is right for your child.</p><ul className="my-7 grid gap-4">{[["Address","1 KM, Chak No. 557/E.B Road, Adda Machiwal, 61070, Tehsil & District Vehari, Punjab, Pakistan",""],["Phone & WhatsApp","0301 0763122","https://wa.me/923010763122"],["Email","thementorschool.info@gmail.com","mailto:thementorschool.info@gmail.com"],["Website","www.thementorschools.com","https://www.thementorschools.com"]].map(([label,value,href])=><li className="grid border-b border-white/10 pb-3" key={label}><b className="text-[11px] uppercase tracking-widest text-yellow-400">{label}</b>{href?<a className="break-words text-zinc-200 hover:text-yellow-400" href={href}>{value}</a>:<span className="text-zinc-200">{value}</span>}</li>)}</ul><div className="flex flex-wrap gap-5 text-sm font-bold text-red-500"><a href="#enroll">Plan your visit →</a><a href="https://www.facebook.com/tms.mentor/" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.youtube.com/@thementorschoolmachianwala8141" target="_blank" rel="noreferrer">YouTube</a></div></div>
      </section>

      <section className="w-full bg-[#080908] px-5 py-20 text-center lg:px-8 lg:py-24"><span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">EDUCATION FOR LIFE</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Built for a <em className="not-italic text-red-500">Global Future</em></h2><p className="text-zinc-400">Strong roots. Open minds. Skills for a changing world.</p><div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">{[["Values","Respect, responsibility and character"],["Knowledge","Clear foundations across every subject"],["Skills","Communication, technology and problem-solving"]].map(([title,text])=><article className="grid rounded-2xl border border-white/15 bg-[#111211] p-6"><b className="text-lg text-yellow-400">{title}</b><span className="mt-2 text-sm text-zinc-400">{text}</span></article>)}</div></section>

      <section className="relative w-full overflow-hidden bg-gradient-to-br from-red-950 via-[#111211] to-yellow-950 px-5 py-24 text-center" id="enroll"><span className="inline-flex rounded-full border border-yellow-400/50 px-3 py-1.5 text-xs font-extrabold text-yellow-400">START THEIR JOURNEY</span><h2 className="my-3 text-[clamp(38px,4.2vw,52px)] font-black tracking-[-.045em]">Enroll Your Child <em className="not-italic text-red-500">Today</em></h2><p className="text-zinc-300">Give your child a lighter school day and a brighter path forward.</p><div className="mx-auto mt-7 flex max-w-md flex-col justify-center gap-3 sm:flex-row"><a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-extrabold hover:bg-red-500" href={signInPath}>Begin online admission</a><a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 bg-white/5 px-5 text-sm font-extrabold hover:border-yellow-400 hover:text-yellow-400" href="tel:+923010763122">Call 0301 0763122</a></div></section>

      <footer className="grid w-full grid-cols-1 items-center gap-5 border-t border-white/10 bg-[#050605] px-5 py-10 text-sm text-zinc-400 md:grid-cols-2 lg:px-[max(calc((100vw-1100px)/2),30px)]"><div className="flex items-center gap-3"><img className="h-14 w-12 object-contain" src="/tms-original-logo-transparent.png" alt="The Mentor School logo"/><div className="grid"><b className="text-lg text-white">The Mentor School</b><small>Education for life</small></div></div><p className="md:text-right"><a className="hover:text-yellow-400" href="mailto:thementorschool.info@gmail.com">thementorschool.info@gmail.com</a><br/><a className="hover:text-yellow-400" href="tel:+923010763122">0301 0763122</a> · Adda Machiwal, Vehari</p><nav className="flex flex-wrap gap-5"><a href="#why-us">Why TMS</a><a href="#curriculum">Curriculum</a><a href="#life">School life</a><a href="#team">Our team</a><a href="https://www.facebook.com/tms.mentor/" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.youtube.com/@thementorschoolmachianwala8141" target="_blank" rel="noreferrer">YouTube</a></nav><small className="md:text-right">© {new Date().getFullYear()} The Mentor School. All rights reserved.</small></footer>
    </main>
  );
}
