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
  { number: '1', label: 'Partner School' },
  { number: '5+', label: 'Workshops Delivered' },
  { number: '1000+', label: 'Students Influenced' },
]

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
