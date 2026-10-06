export const NAV = [
  { to: '/solutions', label: 'What we do', key: 'what' },
  { to: '/about', label: 'Who we are', key: 'who' },
  { to: '/work', label: 'Proof of work', key: 'proof' },
  { to: '/portal', label: 'School portal', key: 'portal' },
  { to: '/faq', label: 'FAQ', key: 'faq' },
]

export const FOOTER_GROUPS = [
  {
    title: 'Explore',
    links: [
      { to: '/solutions', label: 'What we do' },
      { to: '/about', label: 'Who we are' },
      { to: '/work', label: 'Proof of work' },
      { to: '/portal', label: 'School portal' },
      { to: '/verify', label: 'Certificate verification' },
    ],
  },
  {
    title: 'For schools',
    links: [
      { to: '/solutions#robotics', label: 'Robotics' },
      { to: '/solutions#ai-data', label: 'AI & data' },
      { to: '/solutions#connected-systems', label: 'IoT & physical computing' },
      { to: '/solutions#fabrication', label: 'Design & fabrication' },
      { to: '/contact#demo-form', label: 'Plan a school lab' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/careers', label: 'Careers' },
      { to: '/faq', label: 'FAQs' },
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
]

export const CAPABILITIES = [
  {
    id: 'robotics',
    no: '01',
    title: 'Robotics & physical computing',
    navTitle: 'Robotics',
    short: 'Machines students can actually build, wire, debug and control.',
    desc: 'Arduino, sensors, motors and mechanisms become a progression of real builds rather than isolated kit activities. Projects can grow from first circuits into autonomous machines and competition-ready prototypes.',
    image: '/img/robotics_solution.webp',
    imageAlt: 'Students building a robotics project in a school lab',
    includes: ['Microcontrollers & electronics', 'Sensors, motors & actuators', 'Mechanical structures', 'Grade-progressive projects'],
  },
  {
    id: 'ai-data',
    no: '02',
    title: 'AI, data & machine learning',
    navTitle: 'AI & data',
    short: 'From learning what a model does to training one on real data.',
    desc: 'Age-appropriate AI work can move from visual experimentation into Python, data handling and applied machine learning. The emphasis stays on understanding the system students are building, not simply using a black-box tool.',
    image: '/img/ai_solution.webp',
    imageAlt: 'Students learning AI and machine learning in a school technology lab',
    includes: ['Computer vision activities', 'Data & model fundamentals', 'Python & visual coding pathways', 'Applied AI projects'],
  },
  {
    id: 'connected-systems',
    no: '03',
    title: 'IoT & connected systems',
    navTitle: 'IoT & smart systems',
    short: 'Connect sensors, networks and physical systems into something useful.',
    desc: 'Students explore how measurements become decisions and actions: environmental monitors, smart automation, connected devices and sensor-driven systems. Hardware, code and digital interfaces are taught as one loop.',
    image: '/img/iot_solution.webp',
    imageAlt: 'Students working on a connected IoT electronics project',
    includes: ['Sensors & embedded logic', 'Wi-Fi & Bluetooth concepts', 'Smart monitoring systems', 'Physical-to-digital workflows'],
  },
  {
    id: 'fabrication',
    no: '04',
    title: 'Design, CAD & digital fabrication',
    navTitle: 'Design & fabrication',
    short: 'Design on screen, prototype in the real world.',
    desc: 'Students use computational design to make parts, models and functional prototypes. CAD, 3D printing and fabrication turn abstract geometry into objects they can test and improve.',
    image: '/img/comp_design.webp',
    imageAlt: 'Students creating digital designs and prototypes',
    includes: ['3D modelling & CAD', '3D printing workflows', 'Prototype fabrication', 'Design-to-test cycles'],
  },
  {
    id: 'drones',
    no: '05',
    title: 'Drones & aerial systems',
    navTitle: 'Drones',
    short: 'Use flight as a gateway into physics, control and autonomous systems.',
    desc: 'Supervised drone activities connect physical flight to engineering concepts such as stability, navigation, sensing and control. Programme design can combine practical flying with project and competition work.',
    image: '/img/drone_solution.webp',
    imageAlt: 'Students exploring educational drone technology',
    includes: ['Flight fundamentals', 'Assembly & maintenance', 'Navigation & sensing', 'Supervised project challenges'],
  },
  {
    id: 'custom',
    no: '06',
    title: 'Custom school programme design',
    navTitle: 'Custom programme',
    short: 'Start with the timetable, room and goals—not a pre-packed catalogue.',
    desc: 'Schools differ in space, timetable, staffing, board requirements and starting point. We can combine technology domains, hardware, curriculum and teaching support into a programme that fits the actual school environment.',
    image: '/img/workshop_action.webp',
    imageAlt: 'Students working together during a hands-on STEM workshop',
    includes: ['Space-aware planning', 'Board and calendar mapping', 'Mixed technology pathways', 'Flexible delivery models'],
  },
]

export const SYSTEM_LAYERS = [
  { no: '01', title: 'The room', kicker: 'LAB', text: 'Equipment, benches, devices, power, safety and a setup students can use every week.' },
  { no: '02', title: 'The learning path', kicker: 'CURRICULUM', text: 'Grade-aware projects, lesson flow, assessment and a progression from first build to capstone.' },
  { no: '03', title: 'The people', kicker: 'DELIVERY', text: 'Instructors teach alongside teachers, then help the school build internal confidence to keep the lab moving.' },
  { no: '04', title: 'The digital layer', kicker: 'PORTAL', text: 'Student missions, simulation and school workflows connect the physical programme to an online record.' },
]

export const STARTING_POINTS = [
  { id: 'new-lab', label: 'Starting from an empty room', title: 'Build the lab + programme', text: 'Plan the physical setup, choose technology domains, map the curriculum and launch weekly delivery.', href: '/solutions#lab-setup' },
  { id: 'existing-lab', label: 'Already have a lab', title: 'Upgrade what is there', text: 'Keep useful equipment, close capability gaps and add a programme that actually gets the room used.', href: '/contact?intent=proposal#demo-form' },
  { id: 'programme', label: 'Need teaching first', title: 'Add a year-round programme', text: 'Use the space you already have and focus the partnership on curriculum, instructors and teacher development.', href: '/solutions#delivery' },
  { id: 'digital', label: 'Want the software layer', title: 'Connect the school portal', text: 'Give students guided digital missions and simulation while teachers get a clearer operational view.', href: '/portal' },
]

export const PROJECTS = [
  { label: 'Robotics', title: 'Autonomous rover', text: 'Sense → decide → move. A compact project that teaches wiring, control logic and debugging.', image: '/img/zenith/zenith_robot_rover_demo.webp', grade: 'Grades 6–10' },
  { label: 'Physical computing', title: 'Sensor to action', text: 'Students wire real components, read a measurement and turn it into a visible response.', image: '/img/iot_circuit.webp', grade: 'Grades 5–8' },
  { label: 'Applied AI', title: 'Teach a machine to see', text: 'A model becomes tangible when students collect examples, test predictions and reason about mistakes.', image: '/img/ai_learning.webp', grade: 'Grades 7–12' },
  { label: 'Design', title: 'Prototype the mechanism', text: 'From a digital model to a physical part students can hold, measure and iterate.', image: '/img/comp_design.webp', grade: 'Grades 6–12' },
]

export const DELIVERY = [
  { no: '01', title: 'Discover', text: 'Room, infrastructure, grades, timetable, board and goals.' },
  { no: '02', title: 'Plan', text: 'Lab specification, technology mix, curriculum map and delivery calendar.' },
  { no: '03', title: 'Set up', text: 'Equipment, kits, software and classroom-ready configuration.' },
  { no: '04', title: 'Run', text: 'Weekly hands-on sessions with instructor and teacher participation.' },
  { no: '05', title: 'Improve', text: 'Reviews, support, teacher development and programme updates.' },
]

export const PRINCIPLES = [
  { no: '01', title: 'Real materials first', text: 'Students should have something physical to test, break, measure and rebuild.' },
  { no: '02', title: 'Useful for teachers', text: 'A lab is only valuable when the people in the school can confidently use it.' },
  { no: '03', title: 'Designed for the timetable', text: 'The programme has to survive school calendars, class sizes, constraints and term breaks.' },
  { no: '04', title: 'One connected system', text: 'Hardware, curriculum, delivery and digital tools should reinforce each other rather than live in silos.' },
]

export const PROOF = {
  school: 'Zenith Public School, Dadha',
  title: 'A real lab, running as a real programme.',
  text: 'Our public-facing site should show the difference between a concept image and a working school environment. This implementation combines the physical lab, hands-on builds and teacher co-teaching into one story.',
  images: [
    { src: '/img/zenith/zenith_lab_setup.webp', alt: 'Completed innovation and robotics lab setup at Zenith Public School, Dadha', label: 'The room' },
    { src: '/img/zenith/zenith_teacher_co_teaching.webp', alt: 'Teacher co-teaching a hands-on robotics session', label: 'The people' },
    { src: '/img/zenith/zenith_robot_rover_demo.webp', alt: 'Students demonstrating a robotics rover', label: 'The build' },
  ],
}

export const PLATFORM = {
  title: 'The physical lab has a digital twin.',
  text: 'Students can move between real hardware and browser-based practice. Teachers get a digital trail of missions, attendance and progress instead of a disconnected lab notebook.',
  features: ['Guided student missions', 'Browser-based circuit simulation', 'School roster & attendance workflows', 'Published certificate verification'],
}

export const COMPANY = {
  kicker: 'Who we are',
  title: 'We build the layer between a school timetable and a working innovation lab.',
  intro: 'Pixiu Tech is an education-technology company focused on practical STEM, Robotics, AI, IoT and innovation programmes for schools. Our work sits at the intersection of curriculum, hardware, people and software.',
  detail: 'The goal is simple: make advanced technology understandable enough for students to build with, structured enough for teachers to deliver, and practical enough for school leadership to operate over an academic year.',
}
