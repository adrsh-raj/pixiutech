import { BookOpen, Box, CalendarDays, ChartNoAxesCombined, ClipboardCheck, Cpu, CreditCard, FileText, FolderKanban, GraduationCap, LayoutDashboard, Megaphone, PlaySquare, ReceiptText, School, Settings, ShieldCheck, Trophy, Users, Video, WalletCards, KeyRound } from 'lucide-react';

export const PORTAL_NAVIGATION = {
  admin: [
    { title: 'COMMAND CENTER', links: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ] },
    { title: 'BUSINESS', links: [
      { name: 'Sales Pipeline', href: '/leads', icon: FolderKanban },
      { name: 'Partner Schools', href: '/schools', icon: School },
      { name: 'Billing & Invoices', href: '/billing', icon: CreditCard },
      { name: 'Payments & Receipts', href: '/payments', icon: ReceiptText },
    ] },
    { title: 'ACADEMICS', links: [
      { name: 'Student Directory', href: '/students', icon: Users },
      { name: 'Trainer Faculty', href: '/trainers', icon: GraduationCap },
      { name: 'Classes & Sessions', href: '/sessions', icon: CalendarDays },
      { name: 'Curriculum', href: '/curriculum', icon: BookOpen },
      { name: 'Content Hub', href: '/content', icon: PlaySquare },
      { name: 'Quizzes', href: '/quizzes', icon: ClipboardCheck },
      { name: 'Projects', href: '/projects', icon: FolderKanban },
      { name: 'Attendance', href: '/attendance', icon: CalendarDays },
    ] },
    { title: 'ANALYTICS & OPERATIONS', links: [
      { name: 'Hardware & Kits', href: '/inventory', icon: Box },
      { name: 'Notifications', href: '/notifications', icon: ReceiptText },
      { name: 'Audit Logs', href: '/logs', icon: ShieldCheck },
      { name: 'Announcements & Comms', href: '/comms', icon: Megaphone },
    ] },
    { title: 'SYSTEM', links: [
      { name: 'Trainer Credentials', href: '/trainer-credentials', icon: KeyRound },
      { name: 'School Credentials', href: '/school-credentials', icon: KeyRound },
      { name: 'Settings', href: '/settings', icon: Settings },
    ] },
  ],
  student: [
    { title: 'MY LEARNING', links: [
      { name: 'Overview', key: 'overview', icon: LayoutDashboard },
      { name: 'My Classes', key: 'classes', icon: School },
      { name: 'Lessons', key: 'learning', icon: BookOpen },
      { name: 'Quizzes', key: 'quizzes', icon: ClipboardCheck },
      { name: 'Projects', key: 'projects', icon: FolderKanban },
    ] },
    { title: 'MY PERFORMANCE', links: [
      { name: 'Attendance', href: '/student-portal?tab=attendance', icon: CalendarDays },
      { name: 'My Progress', href: '/student-progress', icon: ChartNoAxesCombined },
      { name: 'My Certificates', key: 'certificates', icon: Trophy },
    ] },
    { title: 'MY CLASS', links: [
      { name: 'Class Ranking', href: '/student-ranking', icon: Trophy },
      { name: 'Leaderboard', href: '/student-ranking', icon: Trophy },
    ] },
    { title: 'COMMUNICATION', links: [
      { name: 'Announcements', key: 'announcements', icon: Megaphone },
    ] },
    { title: 'EXPLORE', links: [
      { name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu },
      { name: 'Learning Materials', href: '/content', icon: PlaySquare },
    ] },
  ],
  school: [
    { title: 'MY SCHOOL', links: [
      { name: 'Overview', key: 'overview', icon: LayoutDashboard },
      { name: 'My Classes', key: 'classes', icon: School },
      { name: 'Students', key: 'students', icon: Users },
      { name: 'Trainers', key: 'trainers', icon: GraduationCap },
    ] },
    { title: 'ACADEMICS', links: [
      { name: 'Attendance', href: '/attendance', icon: CalendarDays },
      { name: 'Sessions', href: '/sessions', icon: CalendarDays },
      { name: 'Curriculum', key: 'curriculum', icon: BookOpen },
      { name: 'Learning Materials', href: '/content', icon: PlaySquare },
    ] },
    { title: 'PERFORMANCE', links: [
      { name: 'School Performance', href: '/school-performance', icon: ChartNoAxesCombined },
      { name: 'Class Performance', href: '/school-ranking', icon: Trophy },
      { name: 'Student Rankings', href: '/school-ranking', icon: Trophy },
      { name: 'Progress', key: 'progress', icon: WalletCards },
    ] },
    { title: 'FINANCE', links: [
      { name: 'Billing & Contracts', href: '/billing', icon: WalletCards },
    ] },
    { title: 'COMMUNICATION', links: [
      { name: 'Announcements', key: 'announcements', icon: Megaphone },
      { name: 'Notifications', key: 'notifications', icon: ReceiptText },
    ] },
    { title: 'LAB', links: [
      { name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu },
      { name: 'Hardware & Kits', href: '/inventory', icon: Box },
    ] },
  ],
  trainer: [
    { title: 'MY WORK', links: [
      { name: 'Workspace', href: '/trainers', icon: LayoutDashboard },
      { name: 'My Classes', key: 'classes', icon: School },
      { name: 'My Students', href: '/students', icon: Users },
      { name: "Today's Sessions", href: '/trainers', icon: CalendarDays },
    ] },
    { title: 'ACADEMIC', links: [
      { name: 'Curriculum', href: '/curriculum', icon: BookOpen },
      { name: 'Teaching Materials', href: '/trainer-materials', icon: FileText },
      { name: 'Quizzes', href: '/content', icon: ClipboardCheck },
      { name: 'Projects', href: '/content', icon: FolderKanban },
    ] },
    { title: 'STUDENT PERFORMANCE', links: [
      { name: 'Attendance', href: '/attendance', icon: CalendarDays },
      { name: 'Class Performance', href: '/trainer-ranking', icon: Trophy },
      { name: 'Class Ranking', href: '/trainer-ranking', icon: Trophy },
      { name: 'Student Reviews', href: '/trainers', icon: Trophy },
      { name: 'Trainer Performance', href: '/trainer-performance', icon: ChartNoAxesCombined },
    ] },
    { title: 'COMMUNICATION', links: [
      { name: 'Announcements', href: '/comms', icon: Megaphone },
      { name: 'Notifications', href: '/notifications', icon: ReceiptText },
    ] },
    { title: 'LAB TOOLS', links: [
      { name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu },
      { name: 'Hardware & Kits', href: '/inventory', icon: Box },
    ] },
  ],
};

export const PORTAL_ROLE_LABELS = {
  admin: { name: 'Admin', subtitle: 'Command Center', icon: ShieldCheck },
  student: { name: 'Student', subtitle: 'Learning Portal', icon: GraduationCap },
  school: { name: 'School', subtitle: 'School Operations', icon: School },
  trainer: { name: 'Trainer', subtitle: 'Teaching Workspace', icon: Video },
};
