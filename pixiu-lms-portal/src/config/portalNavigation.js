import { BarChart3, BookOpen, Box, CalendarDays, ClipboardCheck, Cpu, CreditCard, FileText, FolderKanban, GraduationCap, LayoutDashboard, Megaphone, PlaySquare, ReceiptText, School, Settings, ShieldCheck, Trophy, Users, Video, WalletCards, KeyRound, Link2, Award } from 'lucide-react';

export const PORTAL_NAVIGATION = {
  admin: [
    { title: 'COMMAND CENTER', links: [{ name: 'Dashboard', href: '/', icon: LayoutDashboard }] },
    { title: 'BUSINESS', links: [{ name: 'Sales Pipeline', href: '/leads', icon: FolderKanban }, { name: 'Partner Schools', href: '/schools', icon: School }, { name: 'Billing & Invoices', href: '/billing', icon: CreditCard }, { name: 'Payments & Receipts', href: '/payments', icon: ReceiptText }] },
    { title: 'ACADEMICS', links: [{ name: 'Student Directory', href: '/students', icon: Users }, { name: 'Trainer Faculty', href: '/trainers', icon: GraduationCap }, { name: 'Trainer–School Assignments', href: '/trainer-assignments', icon: Link2 }, { name: 'Classes & Sessions', href: '/sessions', icon: CalendarDays }, { name: 'Curriculum', href: '/curriculum', icon: BookOpen }, { name: 'Content Hub', href: '/content', icon: PlaySquare }, { name: 'Quizzes', href: '/quizzes', icon: ClipboardCheck }, { name: 'Projects', href: '/projects', icon: FolderKanban }, { name: 'Attendance', href: '/attendance', icon: CalendarDays }, { name: 'Graduate Certificates', href: '/trainer-certificates', icon: Award }] },
    { title: 'ANALYTICS & OPERATIONS', links: [{ name: 'Hardware & Kits', href: '/inventory', icon: Box }, { name: 'Notifications', href: '/notifications', icon: ReceiptText }, { name: 'Audit Logs', href: '/logs', icon: ShieldCheck }, { name: 'Announcements & Comms', href: '/comms', icon: Megaphone }] },
    { title: 'SYSTEM', links: [{ name: 'Trainer Credentials', href: '/trainer-credentials', icon: KeyRound }, { name: 'School Credentials', href: '/school-credentials', icon: KeyRound }, { name: 'Settings', href: '/settings', icon: Settings }] },
  ],
  student: [
    { title: 'MY LEARNING', links: [{ name: 'Overview', key: 'overview', icon: LayoutDashboard }, { name: 'My Classes', href: '/sessions', icon: School }, { name: 'Lessons', key: 'learning', icon: BookOpen }, { name: 'Quizzes', href: '/quizzes', icon: ClipboardCheck }, { name: 'Projects', href: '/projects', icon: FolderKanban }] },
    { title: 'MY PERFORMANCE', links: [{ name: 'Attendance', key: 'attendance', icon: CalendarDays }, { name: 'My Progress', href: '/student-progress', icon: BarChart3 }, { name: 'Certificates', href: '/student-progress', icon: Trophy }] },
    { title: 'COMMUNICATION', links: [{ name: 'Announcements', key: 'announcements', icon: Megaphone }, { name: 'Notifications', href: '/notifications', icon: ReceiptText }] },
    { title: 'EXPLORE', links: [{ name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu }, { name: 'Learning Materials', href: '/content', icon: PlaySquare }, { name: 'Hardware & Kits', href: '/inventory', icon: Box }] },
  ],
  school: [
    { title: 'MY SCHOOL', links: [{ name: 'Overview', key: 'overview', icon: LayoutDashboard }, { name: 'Students', key: 'students', icon: Users }, { name: 'Trainers', key: 'trainers', icon: GraduationCap }] },
    { title: 'ACADEMICS', links: [{ name: 'Attendance', href: '/attendance', icon: CalendarDays }] },
    { title: 'PERFORMANCE', links: [{ name: 'Progress Reports', href: '/school-progress-reports', icon: BarChart3 }, { name: 'School Performance', href: '/school-performance', icon: BarChart3 }] },
    { title: 'FINANCE', links: [{ name: 'Billing & Contracts', href: '/billing', icon: WalletCards }] },
    { title: 'COMMUNICATION', links: [{ name: 'Announcements', key: 'announcements', icon: Megaphone }, { name: 'Notifications', href: '/notifications', icon: ReceiptText }] },
    { title: 'LAB', links: [{ name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu }, { name: 'Hardware & Kits', href: '/inventory', icon: Box }] },
  ],
  trainer: [
    { title: 'MY WORK', links: [{ name: 'Workspace', key: 'overview', icon: LayoutDashboard }, { name: 'My Classes', href: '/trainer-classes', icon: School }, { name: 'My Students', href: '/students', icon: Users }, { name: "Today's Sessions", href: '/sessions', icon: CalendarDays }] },
    { title: 'ACADEMIC', links: [{ name: 'Curriculum', href: '/curriculum', icon: BookOpen }, { name: 'Teaching Materials', href: '/trainer-materials', icon: FileText }, { name: 'Graduate Certificates', href: '/trainer-certificates', icon: Award }, { name: 'Quizzes', href: '/quizzes', icon: ClipboardCheck }, { name: 'Projects', href: '/projects', icon: FolderKanban }] },
    { title: 'STUDENT PERFORMANCE', links: [{ name: 'Attendance', href: '/attendance', icon: CalendarDays }, { name: 'Class Performance', href: '/trainer-ranking', icon: Trophy }, { name: 'Class Ranking', href: '/trainer-ranking', icon: Trophy }, { name: 'Student Reviews', href: '/trainer-reviews', icon: Trophy }, { name: 'Trainer Performance', href: '/trainer-performance', icon: BarChart3 }] },
    { title: 'COMMUNICATION', links: [{ name: 'Announcements', href: '/notifications', icon: Megaphone }, { name: 'Notifications', href: '/notifications', icon: ReceiptText }] },
    { title: 'LAB TOOLS', links: [{ name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu }, { name: 'Hardware & Kits', href: '/inventory', icon: Box }] },
  ],
};

export const PORTAL_ROLE_LABELS = {
  admin: { name: 'Admin', subtitle: 'Command Center', icon: ShieldCheck },
  student: { name: 'Student', subtitle: 'Learning Portal', icon: GraduationCap },
  school: { name: 'School', subtitle: 'School Operations', icon: School },
  trainer: { name: 'Trainer', subtitle: 'Teaching Workspace', icon: Video },
};
