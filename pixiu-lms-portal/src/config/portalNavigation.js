import { BookOpen, Box, CalendarDays, ClipboardCheck, Cpu, FileText, FolderKanban, GraduationCap, LayoutDashboard, Megaphone, PlaySquare, Receipt, School, Star, Trophy, Users, Video, WalletCards, Award, BarChart3 } from 'lucide-react';

// Navigation is presentation-only. Runtime data, permissions and scope are enforced by Django APIs.
export const PORTAL_NAVIGATION = {
  student: [
    { title: 'MY LEARNING', links: [
      { name: 'Overview', key: 'overview', icon: LayoutDashboard },
      { name: 'My Classes', key: 'classes', icon: School },
      { name: 'Lessons', key: 'learning', icon: BookOpen },
      { name: 'Quizzes', key: 'quizzes', icon: ClipboardCheck },
      { name: 'Projects', key: 'projects', icon: FolderKanban },
    ] },
    { title: 'MY PERFORMANCE', links: [
      { name: 'Attendance', key: 'attendance', icon: CalendarDays },
      { name: 'My Progress', href: '/student-progress', icon: BarChart3 },
      { name: 'My Certificates', key: 'certificates', icon: Award },
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
      { name: 'Attendance', key: 'attendance', icon: CalendarDays },
      { name: 'Sessions', key: 'sessions', icon: CalendarDays },
      { name: 'Curriculum', key: 'curriculum', icon: BookOpen },
      { name: 'Learning Materials', href: '/content', icon: PlaySquare },
    ] },
    { title: 'PERFORMANCE', links: [
      { name: 'School Performance', href: '/school-performance', icon: BarChart3 },
      { name: 'Class Performance', href: '/school-ranking', icon: Trophy },
      { name: 'Student Rankings', href: '/school-ranking', icon: Trophy },
      { name: 'Progress', key: 'progress', icon: WalletCards },
    ] },
    { title: 'COMMUNICATION', links: [
      { name: 'Announcements', key: 'announcements', icon: Megaphone },
      { name: 'Notifications', key: 'notifications', icon: Receipt },
    ] },
    { title: 'LAB', links: [
      { name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu },
      { name: 'Hardware & Kits', key: 'hardware', icon: Box },
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
      { name: 'Attendance', href: '/trainers', icon: CalendarDays },
      { name: 'Class Performance', href: '/trainer-ranking', icon: Trophy },
      { name: 'Class Ranking', href: '/trainer-ranking', icon: Trophy },
      { name: 'Student Reviews', href: '/trainers', icon: Star },
      { name: 'Trainer Performance', href: '/trainer-performance', icon: BarChart3 },
    ] },
    { title: 'COMMUNICATION', links: [
      { name: 'Announcements', href: '/comms', icon: Megaphone },
      { name: 'Notifications', href: '/notifications', icon: Receipt },
    ] },
    { title: 'LAB TOOLS', links: [
      { name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu },
      { name: 'Hardware & Kits', href: '/inventory', icon: Box },
    ] },
  ],
};

export const PORTAL_ROLE_LABELS = {
  student: { name: 'Student', subtitle: 'Learning Portal', icon: GraduationCap },
  school: { name: 'School', subtitle: 'School Operations', icon: School },
  trainer: { name: 'Trainer', subtitle: 'Teaching Workspace', icon: Video },
};
