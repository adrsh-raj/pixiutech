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
  { number: '1', label: 'Flagship Partner School' },
  { number: '4', label: 'Microcontroller Platforms' },
  { number: '30+', label: 'Prototyping & Sensor Modules' },
  { number: '1000+', label: 'Students Engaged' },
]

export const PILLARS = [
  {
    id: 'physical-lab',
    number: '01',
    title: 'Physical Lab Infrastructure',
    tagline: 'Hardware, Tooling & Weekly On-Site Mentorship',
    desc: 'Turnkey lab installation with heavy-duty workstations, Arduino Uno and ESP32 prototyping kits, sensor bins, tools, and dedicated weekly instructors deployed directly to your school.',
    points: [
      'Industrial-grade workstations and component organizers',
      'Arduino, ESP32, motor drivers, and sensor kits per bench',
      'Graded physical lab workbooks for Class 6 to 10',
      'Trained Pixiu Tech specialists co-teaching weekly sessions',
    ],
    actionText: 'Explore Lab Solutions',
    to: '/solutions',
  },
  {
    id: 'cyberlab',
    number: '02',
    title: 'Virtual Cyberlab Simulator',
    tagline: 'Zero-Install Browser Circuit Simulator',
    desc: 'Full-featured online electronics workbench powered by a real-time SPICE solver. Students design, wire, and test circuits without risk of damaged components or hardware bottlenecks.',
    points: [
      'Real-time SPICE simulation kernel for analog and digital circuits',
      'Dual Blockly block coding and standard Arduino C++',
      'Support for Uno, ESP32, Raspberry Pi Pico, and micro:bit',
      'Virtual 2-channel oscilloscope, multimeter, and serial monitor',
    ],
    actionText: 'Launch Cyberlab',
    to: '/simulation',
  },
  {
    id: 'portal',
    number: '03',
    title: 'Dedicated School LMS Portal',
    tagline: 'Missions, Automated Grading & Verifiable Credentials',
    desc: 'Purpose-built student and teacher learning management system at portal.pixiutech.com. Structured curriculum missions, automated step verification, teacher gradebooks, and verifiable certificates.',
    points: [
      'Interactive step-by-step student missions with circuit checks',
      'Gamified XP progression, skill mastery, and streak engine',
      'Teacher gradebook with class rosters and completion tracking',
      'Tamper-proof certificate issuance with instant hash verification',
    ],
    actionText: 'Access School Portal',
    to: '/portal',
  },
]

export const CYBERLAB_SPECS = {
  badge: 'Interactive Simulation',
  title: 'Virtual Cyberlab: Zero-Install Circuit & Code Simulator',
  desc: 'Before picking up a physical screwdriver or soldering iron, students prototype their ideas in our browser-based Cyberlab. Built for speed, safety, and deep conceptual understanding.',
  points: [
    { title: 'SPICE Simulation Engine', detail: 'Accurate real-time voltage, current, and logic simulation directly inside modern web browsers with zero plugin requirements.' },
    { title: '4 Microcontroller Boards', detail: 'Arduino Uno R3, ESP32 with virtual Wi-Fi emulation, Raspberry Pi Pico (RP2040), and BBC micro:bit v2.' },
    { title: 'Dual Visual & C++ Coding', detail: 'Drag-and-drop Blockly blocks for Class 6 to 8 students; standard Arduino C++ and MicroPython for senior students.' },
    { title: '30+ Sensor & Display Parts', detail: 'Ultrasonic distance sensors, PIR motion, DHT11 temperature/humidity, servo motors, LCD1602, OLED displays, and buzzers.' },
    { title: 'Built-In Instrumentation', detail: 'Interactive 2-channel oscilloscope, digital multimeter, and virtual serial monitor for signal debugging.' },
  ],
  passportImage: {
    src: '/img/zenith/zenith_arduino_hands_on.jpg',
    alt: 'Student testing circuit wiring on Arduino Uno at Zenith Public School',
    caption: 'Bridge Virtual to Physical: Circuits simulated in Cyberlab are wired on breadboards at Zenith Public School.',
    tag: 'Physical & Virtual Parity',
  },
}

export const PORTAL_SPECS = {
  badge: 'School & Student LMS',
  title: 'Dedicated Learning Portal for Students & Educators',
  desc: 'A complete operating system for school STEM labs available at portal.pixiutech.com. Connects hands-on experimentation with structured academic accountability.',
  studentFeatures: [
    { title: 'Guided Mission Workbooks', desc: 'Step-by-step schematics and coding prompts that walk students from basic LED blink to autonomous obstacle-avoidance rovers.' },
    { title: 'Instant Circuit Doctor', desc: 'Real-time diagnostic checks pinpoint missing ground connections, misplaced resistors, or invalid pin assignments.' },
    { title: 'Mission XP & Mastery Engine', desc: 'Earn verified experience points, complete streak challenges, and unlock advanced engineering tiers.' },
    { title: 'Verifiable Digital Credentials', desc: 'Cryptographically hashed certificates of completion that schools, parents, and universities can verify at /verify.' },
  ],
  schoolFeatures: [
    { title: 'Class Roster & Attendance', desc: 'Manage batches across sections and grades with attendance records and student lab logins.' },
    { title: 'Automated Evaluation Gradebook', desc: 'Track mission completion percentages, circuit check scores, and submission timelines per student.' },
    { title: 'Anti-Cheat & Plagiarism Audit', desc: 'Built-in code structure analysis ensures students build genuine problem-solving skills.' },
    { title: 'Curriculum Standards Alignment', desc: 'Aligned with CBSE Skill Education standards, Atal Tinkering Lab (ATL) guidelines, and ICSE robotics outcomes.' },
  ],
}

export const SOLUTIONS = [
  {
    id: 'robotics',
    title: 'Robotics Lab',
    short: 'Build, program, and control real machines.',
    desc: 'Complete robotics lab setup with Arduino, sensors, motors, and chassis kits. Students build traffic lights, smart dustbins, obstacle-avoiding robots, and line followers, with projects progressing from Class 6 to Class 11.',
    img: '/img/zenith/zenith_arduino_hands_on.jpg',
    alt: 'Students building and programming Arduino robotics projects at Zenith Public School',
    features: ['Arduino & microcontrollers', 'Sensors & actuators', 'Graded project kits', 'Competition-ready builds'],
  },
  {
    id: 'ai',
    title: 'AI & Machine Learning',
    short: 'Teach machines to see, hear, and decide.',
    desc: 'Introduce students to computer vision, natural language processing, and data science using age-appropriate tools. From block-based AI for younger students to Python-based ML for seniors.',
    img: '/img/zenith/zenith_ai_smart_systems.jpg',
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
    img: '/img/zenith/zenith_student_teamwork.jpg',
    alt: 'Students collaborating on robotics kits during a hands-on STEM workshop',
    features: ['Mapped to CBSE, ICSE, or State requirements', 'Budget-based lab configurations', 'Curriculum mapped to your academic calendar', 'Choose the technology domains you need', 'Space planning for any room size'],
  },
]

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

export const PARTNER_SCHOOL = {
  name: 'Zenith Public School, Dadha',
  established: 'Estd. 1999',
  location: 'Dadha, Greater Noida',
  role: 'Flagship Partner School',
  tagline: 'Full-Scale Robotics & STEM Lab Implementation',
  description: 'Pixiu Tech deployed a complete robotics lab setup, equipped workstations, delivered graded Class 6 to 10 curriculum books, provided hardware prototyping kits, and placed trained instructors for weekly sessions.',
  stats: [
    { label: 'Weekly Hands-On Sessions', value: '100%' },
    { label: 'Grades Covered', value: 'Class 6 - 10' },
    { label: 'Lab Kits Provided', value: 'Arduino & Sensors' },
    { label: 'Teacher Co-Training', value: 'Active' },
  ],
  highlights: [
    {
      title: 'Graded Curriculum Lab Books',
      desc: 'Class 8 Robotics Lab Book delivered directly in weekly sessions covering microcontrollers, ultrasonic distance sensing, servos, and automation logic.',
      img: '/img/zenith/zenith_curriculum_slide.jpg',
      alt: 'Class 8 Robotics Lab Book curriculum presentation at Zenith Public School',
    },
    {
      title: 'Physical Computing on Breadboards',
      desc: 'Every student wires live circuits with Arduino Uno, LEDs, breadboards, and sensors, writing and flashing code directly from laptops.',
      img: '/img/zenith/zenith_arduino_hands_on.jpg',
      alt: 'Student coding Arduino Uno with lit LED on breadboard in Zenith Public School uniform',
    },
    {
      title: 'House Team Collaboration',
      desc: 'Students across school houses collaborate in small teams to build obstacle-avoidance rovers, test line followers, and solve engineering challenges.',
      img: '/img/zenith/zenith_student_teamwork.jpg',
      alt: 'Zenith Public School student teams in house uniforms gathered around robotics demonstration',
    },
    {
      title: 'Teacher Co-Teaching & Mentorship',
      desc: 'School faculty observe and co-teach alongside Pixiu Tech lead instructors, gaining the confidence and skills to run practical sessions.',
      img: '/img/zenith/zenith_teacher_co_teaching.jpg',
      alt: 'School faculty observing Pixiu Tech specialist teaching robotics in school lab',
    },
  ],
}
