// Pixiu Tech — all site copy lives here so it can be edited without touching layout code.

export const NAV = [
  { to: '/', label: 'Home' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/hub', label: 'Resource Hub' },
  { to: '/careers', label: 'Careers' },
  { to: '/contact', label: 'Contact' },
]

export const STATS = [
  { number: '1', label: 'Partner School', icon: '🏫' },
  { number: '5+', label: 'Workshops Delivered', icon: '🔧' },
  { number: '500+', label: 'Students Influenced', icon: '👩‍🎓' },
  { number: '8', label: 'Grade Levels', icon: '📚' },
]

export const SOLUTIONS = [
  {
    id: 'robotics',
    title: 'Robotics Lab',
    short: 'Build, program, and control real machines.',
    desc: 'Complete robotics lab setup with Arduino, sensors, motors, and chassis kits. Students build traffic lights, smart dustbins, obstacle-avoiding robots, and line followers — progressing from Class 6 to Class 11.',
    img: '/img/robotics_solution.jpg',
    features: ['Arduino & microcontrollers', 'Sensors & actuators', 'Graded project kits', 'Competition-ready builds'],
  },
  {
    id: 'ai',
    title: 'AI & Machine Learning',
    short: 'Teach machines to see, hear, and decide.',
    desc: 'Introduce students to computer vision, natural language processing, and data science using age-appropriate tools. From block-based AI for younger students to Python-based ML for seniors.',
    img: '/img/ai_solution.jpg',
    features: ['Computer vision projects', 'Chatbot building', 'Data science basics', 'Python & block coding'],
  },
  {
    id: 'design',
    title: 'Computational Design & 3D',
    short: 'Design on screen, print in hand.',
    desc: 'CAD modeling, 3D printing, and laser cutting integrated into the curriculum. Students learn to design mechanical parts, artistic models, and functional prototypes.',
    img: '/img/comp_design.jpg',
    features: ['3D modeling & CAD', '3D printer setup', 'Laser cutting', 'Prototype fabrication'],
  },
  {
    id: 'drone',
    title: 'Drone Technology',
    short: 'Fly, navigate, and program aerial systems.',
    desc: 'Educational drone kits for understanding flight dynamics, GPS navigation, and autonomous programming. Safe, supervised outdoor flying integrated with physics and math.',
    img: '/img/drone_solution.jpg',
    features: ['Quadcopter assembly', 'Flight dynamics', 'GPS & navigation', 'Aerial photography'],
  },
  {
    id: 'iot',
    title: 'IoT & Smart Systems',
    short: 'Connect the physical world to the digital.',
    desc: 'Internet of Things projects using sensors, Wi-Fi modules, and cloud dashboards. Students build smart weather stations, automated gardens, and security systems.',
    img: '/img/iot_solution.jpg',
    features: ['Sensor networks', 'Wi-Fi & Bluetooth', 'Cloud dashboards', 'Home automation'],
  },
  {
    id: 'custom',
    title: 'Custom School Solutions',
    short: 'Your school, your lab, your way.',
    desc: 'Every school is different. We design custom lab configurations, select hardware to match your budget, and build curriculum around your academic calendar and board requirements.',
    img: '/img/workshop_action.jpg',
    features: ['Board-aligned curriculum', 'Budget flexibility', 'Space planning', 'Custom kit selection'],
  },
]

export const PROCESS = [
  { no: '01', name: 'Plan', text: 'We assess your space, budget, and goals. You get a detailed lab blueprint and curriculum map.', icon: '📋' },
  { no: '02', name: 'Build', text: 'We set up the lab — tables, equipment, kits, software — ready to teach from Day 1.', icon: '🔨' },
  { no: '03', name: 'Teach', text: 'Our trained instructors deliver weekly sessions. Your teachers learn alongside.', icon: '🎓' },
  { no: '04', name: 'Support', text: 'Ongoing maintenance, kit replacements, curriculum updates, and term reviews.', icon: '🤝' },
]

export const WHY = [
  { title: 'End-to-End', desc: 'One partner for lab setup, hardware, curriculum, instructors, and support. No juggling vendors.', icon: '🔗' },
  { title: 'Hands-On Learning', desc: 'Every session has a build. Students make real things, not watch slideshows.', icon: '🛠️' },
  { title: 'Long-Term Partner', desc: "We don't install and leave. Ongoing classes, support, and curriculum updates term after term.", icon: '🤝' },
]

export const CAREERS = [
  {
    title: 'STEM Instructor',
    location: 'Hata, UP',
    type: 'Full-time',
    desc: 'Deliver robotics and coding sessions in partner schools. Train students from Class 3 to 11 (except 10) on Arduino, sensors, and project-based learning.',
  },
  {
    title: 'Curriculum Developer',
    location: 'Remote',
    type: 'Part-time',
    desc: 'Design graded STEM curriculum, write student workbooks, and create project guides aligned with CBSE/ICSE standards.',
  },
]
