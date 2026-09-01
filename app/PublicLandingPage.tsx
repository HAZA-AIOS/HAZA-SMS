const learning = [
  ["📕", "Less carrying", "A bag-free school day built around purposeful classroom learning."],
  ["🧠", "Deep understanding", "Short explanations, guided practice and meaningful revision."],
  ["🌱", "Whole-child growth", "Confidence, communication, character and healthy movement."],
];

const values = [
  ["🎯", "Personal attention", "A clear learning path with support that meets children where they are."],
  ["📚", "Strong foundations", "Reading, writing, mathematics and scientific thinking developed step by step."],
  ["💻", "Digital confidence", "Technology is used as a practical learning tool, not a distraction."],
  ["🤝", "Parent partnership", "Families stay informed and connected throughout the learning journey."],
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
  ["English", "IXL UK", "Language, comprehension, writing and confident communication."],
  ["Mathematics", "California", "Visual reasoning, problem-solving and strong number sense."],
  ["Science", "CGP UK", "Curiosity-led science from early concepts to practical understanding."],
  ["Computing", "Digital skills", "Safe, creative and productive use of modern technology."],
];

export default function PublicLandingPage({ signInPath }: { signInPath: string }) {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a href="#home" className="landing-brand" aria-label="The Mentor School home">
          <img src="/tms-original-logo-transparent.png" alt="The Mentor School original logo" />
          <span><b>The Mentor School</b><small>Education for life</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#why-us">Why us</a><a href="#curriculum">Curriculum</a><a href="#life">School life</a><a href="#campus">Campus</a>
        </nav>
        <a className="nav-cta" href={signInPath}>School portal <span>↗</span></a>
      </header>

      <section className="landing-hero" id="home">
        <img className="hero-photo" src="/tms-landing-hero.jpg" alt="Students learning together with their teacher" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="landing-kicker"><i /> ADMISSIONS OPEN</span>
          <h1>A Bag-Free School.<br />Where <em>Learning Is Light.</em><br />The Future Is <strong>Bright.</strong></h1>
          <p>Modern learning, strong values and personal attention—designed to help every child grow with confidence.</p>
          <div className="hero-actions"><a href="#enroll">Enroll your child</a><a className="outline" href="#why-us">Explore our approach</a></div>
          <div className="hero-proof"><span><b>R1–Grade 8</b><small>Complete learning journey</small></span><span><b>Bag-free</b><small>Purposeful school days</small></span><span><b>Global</b><small>Curriculum outlook</small></span></div>
        </div>
        <aside className="hero-panel"><span>THE TMS PROMISE</span><h2>Learning that feels lighter—and goes deeper.</h2><ul><li>✓ Minimal homework</li><li>✓ Modern digital resources</li><li>✓ Small-school attention</li><li>✓ Values-led education</li></ul></aside>
      </section>

      <section className="landing-section intro" id="why-us">
        <span className="section-label">OUR APPROACH</span><h2>A Smarter Way to <em>Learn</em></h2><p className="section-lead">School should prepare children for life, not simply prepare them for the next test.</p>
        <div className="learning-grid">{learning.map(([icon,title,text])=><article key={title}><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landing-section values-section">
        <span className="section-label">WHAT WE BELIEVE</span><h2>What We <em>Stand For</em></h2><p className="section-lead">A clear promise to students and families.</p>
        <div className="values-grid">{values.map(([icon,title,text])=><article key={title}><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landing-section advantage-section">
        <span className="section-label">WHY TMS</span><h2>The TMS <em>Advantage</em></h2>
        <div className="advantage-grid">{advantages.map(([n,title,text],i)=><article key={title} className={i===2||i===4?"photo-card":""}><b>{n}</b><h3>{title}</h3><p>{text}</p>{(i===2||i===4)&&<img src="/tms-campus-life.jpg" alt="Students taking part in school activities" />}</article>)}</div>
      </section>

      <section className="landing-section thrive-section">
        <span className="section-label">BEYOND THE CLASSROOM</span><h2>Where Students <em>Thrive</em></h2><p className="section-lead">Confidence grows when children learn, create, play and belong.</p>
        <div className="story-gallery"><figure className="wide"><img src="/tms-campus-life.jpg" alt="Students enjoying an outdoor team activity" /><figcaption><b>Sports & teamwork</b><span>Healthy bodies. Stronger friendships.</span></figcaption></figure><figure><img src="/tms-landing-hero.jpg" alt="Collaborative classroom learning" /><figcaption><b>Active classrooms</b><span>Questions, discussion and discovery.</span></figcaption></figure><figure><img src="/tms-campus-life.jpg" alt="School community activity" /><figcaption><b>School community</b><span>Moments children remember.</span></figcaption></figure></div>
      </section>

      <section className="landing-section courses-section" id="curriculum">
        <span className="section-label">BUILT FOR THE WORLD</span><h2>International-Standard <em>Courses</em></h2><p className="section-lead">Trusted learning approaches, thoughtfully adapted for our students.</p>
        <div className="course-grid">{courses.map(([title,badge,text])=><article key={title}><span>{badge}</span><h3>{title}</h3><p>{text}</p><a href="#enroll">Explore learning →</a></article>)}</div>
      </section>

      <section className="landing-section life-section" id="life">
        <span className="section-label">EVERY DAY COUNTS</span><h2>Life at <em>TMS</em></h2><p className="section-lead">Rich school days filled with learning, friendship, movement and creativity.</p>
        <div className="life-collage"><img className="large" src="/tms-campus-life.jpg" alt="Outdoor school life" /><img src="/tms-landing-hero.jpg" alt="Learning in the classroom" /><img src="/tms-campus-life.jpg" alt="Teamwork at school" /><img src="/tms-landing-hero.jpg" alt="Teacher supporting students" /></div>
      </section>

      <section className="landing-section parent-section">
        <span className="section-label">TRUSTED BY FAMILIES</span><h2>What Parents & <em>Students</em> Say</h2>
        <blockquote><span>“</span><p>The difference is visible in confidence, curiosity and the way children talk about their school day. Learning feels meaningful and they are excited to return.</p><footer><b>A TMS parent</b><small>The Mentor School community</small></footer></blockquote>
      </section>

      <section className="landing-section curriculum-section">
        <div><span className="section-label">A CONNECTED JOURNEY</span><h2>Our <em>Curriculum</em> by Grade Level</h2><p>From Reception to Grade 8, each stage strengthens the skills needed for what comes next.</p></div>
        <div className="grade-track"><span><b>Reception 1–2</b><small>Play, language and early number sense</small></span><i /><span><b>Grades 1–2</b><small>Core foundations and confident expression</small></span><i /><span><b>Grades 3–5</b><small>Knowledge, reasoning and independence</small></span><i /><span><b>Grades 6–8</b><small>Analysis, application and future readiness</small></span></div>
      </section>

      <section className="landing-section campus-section" id="campus">
        <div className="campus-image"><img src="/tms-campus-life.jpg" alt="Students enjoying campus life" /></div>
        <div className="campus-copy"><span className="section-label">WELCOME TO OUR SCHOOL</span><h2>Visit Our <em>Campus</em></h2><p>See our learning environment, meet the team and discover whether The Mentor School is right for your child.</p><ul><li><b>Address</b><span>1 KM Chak No. 557/E.B Road, Adda Machiwal, Vehari</span></li><li><b>Phone</b><span>0301 0763122</span></li><li><b>Admissions</b><span>Reception 1 through Grade 8</span></li></ul><a href="#enroll">Plan your visit →</a></div>
      </section>

      <section className="landing-section future-section"><span className="section-label">EDUCATION FOR LIFE</span><h2>Built for a <em>Global Future</em></h2><p>Strong roots. Open minds. Skills for a changing world.</p><div><article><b>Values</b><span>Respect, responsibility and character</span></article><article><b>Knowledge</b><span>Clear foundations across every subject</span></article><article><b>Skills</b><span>Communication, technology and problem-solving</span></article></div></section>

      <section className="landing-section enroll-section" id="enroll"><div className="enroll-glow"/><span className="section-label">START THEIR JOURNEY</span><h2>Enroll Your Child <em>Today</em></h2><p>Give your child a lighter school day and a brighter path forward.</p><div><a href={signInPath}>Begin online admission</a><a className="outline" href="tel:+923010763122">Call 0301 0763122</a></div></section>

      <footer className="landing-footer"><div className="footer-brand"><img src="/tms-original-logo-transparent.png" alt="The Mentor School logo"/><div><b>The Mentor School</b><small>Education for life</small></div></div><p>A modern, bag-free school serving families in Adda Machiwal, Vehari.</p><nav><a href="#why-us">Why TMS</a><a href="#curriculum">Curriculum</a><a href="#life">School life</a><a href="#campus">Contact</a></nav><small>© {new Date().getFullYear()} The Mentor School. All rights reserved.</small></footer>
    </main>
  );
}
