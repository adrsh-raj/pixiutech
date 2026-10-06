// Pixiu Tech: all site copy lives here so it can be edited without touching layout code.

export const NAV = [
  { to: '/', label: 'Home' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/portal', label: 'Portal' },
  { to: '/verify', label: 'Verify' },
  { to: '/faq', label: 'FAQ' },
  { to: '/careers', label: 'Careers' },
  { to: '/contact', label: 'Contact' },
]

export const STATS = [
  { number: '1+', label: 'Partner Schools' },
  { number: '5+', label: 'Workshops Delivered' },
  { number: '1000+', label: 'Students Influenced' },
]

export const SOLUTIONS = [
  {
    id: 'robotics',
    title: 'Robotics Lab',
    short: 'Build, program, and control real machines.',
    desc: 'Complete robotics lab setup with Arduino, sensors, motors, and chassis kits. Students build traffic lights, smart dustbins, obstacle-avoiding robots, and line followers, with projects progressing from Class 6 to Class 11.',
    img: '/img/robotics_solution.jpg',
    alt: 'Students building and programming a robotics project in a school lab',
    features: ['Arduino & microcontrollers', 'Sensors & actuators', 'Graded project kits', 'Competition-ready builds'],
  },
  {
    id: 'ai',
    title: 'AI & Machine Learning',
    short: 'Teach machines to see, hear, and decide.',
    desc: 'Introduce students to computer vision, natural language processing, and data science using age-appropriate tools. From block-based AI for younger students to Python-based ML for seniors.',
    img: '/img/ai_solution.jpg',
    alt: 'Students learning AI and machine learning in a school technology lab',
    features: ['Computer vision projects', 'Chatbot building', 'Data science basics', 'Python & block coding'],
  },
  {
    id: 'design',
    title: 'Computational Design & 3D',
    short: 'Design on screen, print in hand.',
    desc: 'CAD modeling, 3D printing, and laser cutting integrated into the curriculum. Students learn to design mechanical parts, artistic models, and functional prototypes.',
    img: '/img/comp_design.jpg',
    alt: 'Students creating 3D designs and prototypes in an innovation lab',
    features: ['3D modeling & CAD', '3D printer setup', 'Laser cutting', 'Prototype fabrication'],
  },
  {
    id: 'drone',
    title: 'Drone Technology',
    short: 'Fly, navigate, and program aerial systems.',
    desc: 'Educational drone kits for understanding flight dynamics, GPS navigation, and autonomous programming. Safe, supervised outdoor flying integrated with physics and math.',
    img: '/img/drone_solution.jpg',
    alt: 'Educational drone technology project for school students',
    features: ['Quadcopter assembly', 'Flight dynamics', 'GPS & navigation', 'Aerial photography'],
  },
  {
    id: 'iot',
    title: 'IoT & Smart Systems',
    short: 'Connect the physical world to the digital.',
    desc: 'Internet of Things projects using sensors, Wi-Fi modules, and cloud dashboards. Students build smart weather stations, automated gardens, and security systems.',
    img: '/img/iot_solution.jpg',
    alt: 'Students building an IoT smart system with sensors',
    features: ['Sensor networks', 'Wi-Fi & Bluetooth', 'Cloud dashboards', 'Home automation'],
  },
  {
    id: 'custom',
    title: 'Custom School Solutions',
    short: 'Your school, your lab, your way.',
    desc: 'Every school has different budgets, spaces, boards, and teaching goals. We work with your management to define the requirement and design the lab around it. That can be a small robotics corner for primary classes or a full innovation lab for senior students, with the hardware, curriculum, session frequency, and instructor deployment matched to your academic calendar.',
    img: '/img/workshop_action.jpg',
    alt: 'Students working with robotics kits during a hands-on STEM workshop',
    features: ['Mapped to CBSE, ICSE, or State requirements', 'Budget-based lab configurations', 'Curriculum mapped to your academic calendar', 'Choose the technology domains you need', 'Space planning for any room size'],
  },
]

export const REAL_LAB_SHOWCASE = {
  badge: 'School Lab Delivery',
  title: 'Real-World Lab Implementation in Action',
  desc: 'We do not just supply hardware kits; our specialist instructors run weekly hands-on sessions in partner schools, helping students wire real circuits and build working machines.',
  quote: {
    text: 'Pixiu Tech provides the complete ecosystem: curriculum lab books, physical component kits, and specialist instructors who teach our students while our teachers upskill alongside.',
    cite: 'School Leadership · STEM & Robotics Innovation Lab',
  },
  items: [
    {
      title: 'Physical Computing on Breadboards',
      desc: 'Students learn hands-on electronics by wiring live circuits with microcontrollers, LEDs, breadboards, and sensors, building foundational engineering skills.',
      img: '/img/iot_circuit.jpg',
      alt: 'Students assembling and prototyping electronic circuits on breadboards',
      badge: 'Physical Computing',
      meta: 'Hands-On Build',
    },
    {
      title: 'Graded Curriculum Lab Books',
      desc: 'Dedicated instructors guide students through graded Robotics Lab Books covering microcontrollers, ultrasonic sensing, and automation logic.',
      img: '/img/zenith/zenith_curriculum_slide.jpg',
      alt: 'Robotics trainer guiding students through curriculum presentation in partner school lab',
      badge: 'Structured Curriculum',
      meta: 'Trainer Delivery',
    },
  ],
}

export const PORTAL_SHOWCASE = {
  badge: 'Student & School LMS',
  title: 'Dedicated Learning Portal for Students & Educators',
  desc: 'Every Pixiu Tech lab is powered by our online learning portal at portal.pixiutech.com. Students log in to access step-by-step missions and the integrated virtual circuit simulator, while teachers track student progress and attendance.',
  studentFeatures: [
    { title: 'Interactive Guided Missions', desc: 'Step-by-step schematics and coding prompts walking students from basic LED blinking to autonomous robotics.' },
    { title: 'Integrated Virtual Circuit Simulator', desc: 'Practice wiring and coding Arduino, ESP32, and sensors in the browser before using physical hardware.' },
    { title: 'Instant Circuit Doctor Diagnostics', desc: 'Real-time error checks detect missing grounds, misplaced resistors, or invalid pin assignments immediately.' },
    { title: 'Mission XP & Verifiable Certificates', desc: 'Earn verified experience points, complete streak challenges, and unlock digital completion certificates.' },
  ],
  schoolFeatures: [
    { title: 'Class Roster & Attendance Tracking', desc: 'Manage batches across sections and grades with attendance records and student lab logins.' },
    { title: 'Automated Evaluation Gradebook', desc: 'Track mission completion percentages, circuit check scores, and submission timelines per student.' },
    { title: 'Anti-Cheat & Plagiarism Audit', desc: 'Built-in code structure analysis ensures students build genuine problem-solving skills.' },
    { title: 'Curriculum Standards Alignment', desc: 'Aligned with CBSE Skill Education standards, Atal Tinkering Lab (ATL) guidelines, and ICSE robotics outcomes.' },
  ],
}

export const PROCESS = [
  { no: '01', name: 'Plan', text: 'We assess your space, budget, and goals. You get a detailed lab blueprint and curriculum map.' },
  { no: '02', name: 'Build', text: 'We set up the lab, including tables, equipment, kits, and software, ready for classes from Day 1.' },
  { no: '03', name: 'Teach', text: 'Our trained instructors deliver weekly sessions. Your teachers learn alongside.' },
  { no: '04', name: 'Support', text: 'Ongoing maintenance, kit replacements, curriculum updates, and term reviews.' },
]

export const WHY = [
  { title: 'End-to-End', desc: 'One partner for lab setup, hardware, curriculum, instructors, and support. No juggling vendors.' },
  { title: 'Hands-On Learning', desc: 'Every session has a build. Students make real things, not watch slideshows.' },
  { title: 'Long-Term Partner', desc: "We don't install and leave. Ongoing classes, support, and curriculum updates term after term." },
]
