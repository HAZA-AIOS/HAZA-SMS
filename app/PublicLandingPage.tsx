const learning = [
  ["▣", "Bag-Free Learning", "All learning materials are provided at school. Students carry only a light folder—no heavy bags."],
  ["◷", "Minimal Homework", "Learning is completed during school hours. Homework is given only twice a week and is research-based."],
  ["⌁", "AI-Enhanced Education", "Students use visual learning and purposeful AI tools to understand concepts that simple teaching cannot."],
];

const values = [
  ["▣", "Bag-Free Learning", "Students carry only a light folder. All materials are provided at school—no heavy bags or physical strain."],
  ["⌁", "AI-Enhanced Education", "We use AI technology and visual learning to prepare students for a future built on intelligence."],
  ["◎", "Global Curriculum", "An international-standard model means our students can move anywhere and never feel behind."],
  ["♡", "Stress-Free Growth", "Minimal homework, research-based learning and a nurturing environment where wellbeing comes first."],
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
  ["English", "UK English", "British subject content builds authentic language, comprehension, writing and confident communication."],
  ["Mathematics", "California Mathematics", "A deep, guided programme connecting mathematics with science, social studies and technology."],
  ["Science", "UK KS1 · KS2 · KS3", "Accessible, attractive science content that encourages curiosity, participation and practical understanding."],
  ["Computing", "Code Studio", "Block-based coding, digital skills and responsible AI research designed for confident new learners."],
];

const teamGroups = [
  ["/school/school-office.webp", "School Leadership", "Direction, planning and a safe, purposeful learning culture."],
  ["/school/classroom-learning.webp", "Teaching Faculty", "Dedicated educators guiding every child with care and clear learning goals."],
  ["/school/student-achievement.webp", "Student Support Team", "Helping students grow in confidence, character, participation and responsibility."],
];

export default function PublicLandingPage({ signInPath }: { signInPath: string }) {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <a href="#home" className="landing-brand" aria-label="The Mentor School home">
            <img src="/tms-original-logo-transparent.png" alt="The Mentor School original logo" />
            <span><b>The Mentor <em>School</em></b></span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#home">Home</a><a href="#why-us">Our Approach</a><a href="#advantage">Why TMS</a><a href="#curriculum">Curriculum</a><a href="#life">Gallery</a><a href="#team">Our Team</a><a href="#campus">Contact</a>
          </nav>
          <a className="portal-link" href={signInPath}>Dashboard</a><a className="nav-cta" href="#enroll">Enroll Now</a>
        </div>
      </header>

      <section className="landing-hero" id="home">
        <div className="hero-shell">
          <div className="hero-copy">
            <span className="landing-kicker"><i /> BAG-FREE · AI-ENHANCED EDUCATION</span>
            <h1>A Bag-Free School.<br />Where <em>Learning Is Light.</em><br />The Future Is <strong>Bright.</strong></h1>
            <p>The Mentor School is a bag-free school where students carry only a light folder. With minimal homework twice a week, research-based AI assignments and an international-standard curriculum, students learn deeply without carrying the traditional burden.</p>
            <div className="hero-actions"><a href="#enroll">Enroll your child</a><a className="outline" href="#why-us">Explore our approach</a></div>
            <div className="hero-proof"><span><b>R1–Grade 8</b><small>Complete learning journey</small></span><span><b>Bag-free</b><small>Purposeful school days</small></span><span><b>Global</b><small>Curriculum outlook</small></span></div>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit" />
            <img className="hero-photo" src="/school/classroom-learning.webp" alt="Students learning at The Mentor School" />
            <aside className="hero-panel"><span>WHY THE MENTOR SCHOOL?</span><h2>A lighter school day. A brighter future.</h2><ul><li>✓ No heavy bags</li><li>✓ Minimal homework</li><li>✓ Conceptual learning</li><li>✓ AI-enhanced education</li><li>✓ Balanced school life</li></ul></aside>
          </div>
        </div>
      </section>

      <section className="landing-section intro" id="why-us">
        <span className="section-label">OUR APPROACH</span><h2>A Smarter Way to <strong>Learn</strong></h2>
        <div className="learning-grid">{learning.map(([icon,title,text])=><article key={title}><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landing-section values-section">
        <span className="section-label">OUR CORE VALUES</span><h2>What We <em>Stand For</em></h2><p className="section-lead">Four principles that shape everything we do at The Mentor School.</p>
        <div className="values-grid">{values.map(([icon,title,text])=><article key={title}><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landing-section advantage-section" id="advantage">
        <span className="section-label">WHY TMS</span><h2>The TMS <em>Advantage</em></h2>
        <div className="advantage-grid">{advantages.map(([n,title,text],i)=><article key={title} className={i===2||i===4?"photo-card":""}><b>{n}</b><h3>{title}</h3><p>{text}</p>{i===2&&<img src="/school/campus-ground.webp" alt="The Mentor School green campus ground" />}{i===4&&<img src="/school/school-exterior.webp" alt="The Mentor School campus exterior" />}</article>)}</div>
      </section>

      <section className="landing-section thrive-section">
        <span className="section-label">BEYOND THE CLASSROOM</span><h2>Where Students <em>Thrive</em></h2><p className="section-lead">Confidence grows when children learn, create, play and belong.</p>
        <div className="story-gallery"><figure className="wide"><img src="/school/sports-team.webp" alt="Students enjoying an outdoor team activity" /><figcaption><b>Sports & teamwork</b><span>Healthy bodies. Stronger friendships.</span></figcaption></figure><figure><img src="/school/student-achievement.webp" alt="Students celebrating an academic achievement" /><figcaption><b>Student achievement</b><span>Confidence built through participation.</span></figcaption></figure><figure><img src="/school/food-festival.webp" alt="The Mentor School community food festival" /><figcaption><b>School community</b><span>Moments children remember.</span></figcaption></figure></div>
      </section>

      <section className="landing-section courses-section" id="curriculum">
        <span className="section-label">BUILT FOR THE WORLD</span><h2>International-Standard <em>Courses</em></h2><p className="section-lead">Trusted learning approaches, thoughtfully adapted for our students.</p>
        <div className="course-grid">{courses.map(([title,badge,text])=><article key={title}><span>{badge}</span><h3>{title}</h3><p>{text}</p><a href="#enroll">Explore learning →</a></article>)}</div>
      </section>

      <section className="landing-section life-section" id="life">
        <span className="section-label">EVERY DAY COUNTS</span><h2>Life at <em>TMS</em></h2><p className="section-lead">Rich school days filled with learning, friendship, movement and creativity.</p>
        <div className="life-collage"><img className="large" src="/school/school-event.webp" alt="A colorful outdoor event at The Mentor School" /><img src="/school/morning-assembly.webp" alt="Students participating in the morning assembly" /><img src="/school/examination-day.webp" alt="Students completing an assessment" /><img src="/school/outdoor-activities.webp" alt="Students taking part in outdoor activities" /></div>
        <div className="life-gallery-strip"><figure><img src="/school/campus-walkway.webp" alt="The green campus walkway" /><figcaption>Green campus</figcaption></figure><figure><img src="/school/classroom-environment.webp" alt="A prepared classroom at The Mentor School" /><figcaption>Prepared classrooms</figcaption></figure><figure><img src="/school/student-assessment.webp" alt="Students working during an assessment" /><figcaption>Focused learning</figcaption></figure></div>
      </section>

      <section className="landing-section team-section" id="team">
        <span className="section-label">OUR FACULTY</span>
        <h2>Meet the <em>Educators</em></h2>
        <p className="section-lead">Passionate, qualified and dedicated to nurturing every student’s potential—the team behind The Mentor School.</p>
        <div className="team-grid">{teamGroups.map(([image,title,text])=><article key={title}><img src={image} alt={title} /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
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
        <div className="campus-image"><img src="/school/school-exterior.webp" alt="The Mentor School campus in Adda Machiwal" /></div>
        <div className="campus-copy"><span className="section-label">WELCOME TO OUR SCHOOL</span><h2>Visit Our <em>Campus</em></h2><p>See our learning environment, meet the team and discover whether The Mentor School is right for your child.</p><ul><li><b>Address</b><span>1 KM, Chak No. 557/E.B Road, Adda Machiwal, 61070, Tehsil & District Vehari, Punjab, Pakistan</span></li><li><b>Phone & WhatsApp</b><a href="https://wa.me/923010763122">0301 0763122</a></li><li><b>Email</b><a href="mailto:thementorschool.info@gmail.com">thementorschool.info@gmail.com</a></li><li><b>Website</b><a href="https://www.thementorschools.com">www.thementorschools.com</a></li></ul><div className="campus-links"><a href="#enroll">Plan your visit →</a><a href="https://www.facebook.com/tms.mentor/" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.youtube.com/@thementorschoolmachianwala8141" target="_blank" rel="noreferrer">YouTube</a></div></div>
      </section>

      <section className="landing-section future-section"><span className="section-label">EDUCATION FOR LIFE</span><h2>Built for a <em>Global Future</em></h2><p>Strong roots. Open minds. Skills for a changing world.</p><div><article><b>Values</b><span>Respect, responsibility and character</span></article><article><b>Knowledge</b><span>Clear foundations across every subject</span></article><article><b>Skills</b><span>Communication, technology and problem-solving</span></article></div></section>

      <section className="landing-section enroll-section" id="enroll"><div className="enroll-glow"/><span className="section-label">START THEIR JOURNEY</span><h2>Enroll Your Child <em>Today</em></h2><p>Give your child a lighter school day and a brighter path forward.</p><div><a href={signInPath}>Begin online admission</a><a className="outline" href="tel:+923010763122">Call 0301 0763122</a></div></section>

      <footer className="landing-footer"><div className="footer-brand"><img src="/tms-original-logo-transparent.png" alt="The Mentor School logo"/><div><b>The Mentor School</b><small>Education for life</small></div></div><p><a href="mailto:thementorschool.info@gmail.com">thementorschool.info@gmail.com</a><br/><a href="tel:+923010763122">0301 0763122</a> · Adda Machiwal, Vehari</p><nav><a href="#why-us">Why TMS</a><a href="#curriculum">Curriculum</a><a href="#life">School life</a><a href="#team">Our team</a><a href="https://www.facebook.com/tms.mentor/" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.youtube.com/@thementorschoolmachianwala8141" target="_blank" rel="noreferrer">YouTube</a></nav><small>© {new Date().getFullYear()} The Mentor School. All rights reserved.</small></footer>
    </main>
  );
}
