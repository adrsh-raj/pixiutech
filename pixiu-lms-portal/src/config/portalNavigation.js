import { BookOpen, Box, CalendarDays, ClipboardCheck, Cpu, FileFileText, FolderKanban, GraduationCap, LayoutDashboard, PlaySquare, Star, Trophy, Users, Video } from 'lucide-react';

// Learner/faculty navigation is presentation-only. Runtime records, permissions,
// scores and assignments come from Django/PostgreSQL APIs.
export const PORTAL_NAVIGATION = {
  student: [
    {
      title: 'MY LEARNING',
      links: [
        { name: 'Overview', key: 'overview', icon: LayoutDashboard },
        { name: 'My Learning', key: 'learning', icon: BookOpen },
        { name: 'Quizzes', key: 'quizzes', icon: ClipboardCheck },
        { name: 'Projects', key: 'projects', icon: FolderKanban },
      ],
    },
    {
      title: 'MY PROGRESS',
      links: [
        { name: 'Attendance', key: 'attendance', icon: CalendarDays },
        { name: 'Trainer Reviews', key: 'reviews', icon: Star },
        { name: 'Class Ranking', href: '/student-ranking', icon: Trophy },
      ],
    },
    {
      title: 'EXPLORE',
      links: [
        { name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu },
        { name: 'Learning Materials', href: '/content', icon: PlaySquare },
      ],
    },
  ],
  trainer: [
    {
      title: 'TEACHING',
      links: [
        { name: 'Workspace', href: '/trainers', icon: LayoutDashboard },
        { name: 'My Students', href: '/students', icon: Users },
        { name: 'Sessions', href: '/trainers', icon: CalendarDays },
        { name: 'Materials', href: '/trainer-materials', icon: FileFileText },
      ],
    },
    {
      title: 'PERFORMANCE',
      links: [
        { name: 'Class Performance', href: '/trainer-ranking', icon: Trophy },
        { name: 'Student Reviews', href: '/trainers', icon: Star },
      ],
    },
    {
      title: 'CURRICULUM',
      links: [
        { name: 'Curriculum Plans', href: '/curriculum', icon: BookOpen },
        { name: 'Content Hub', href: '/content', icon: PlaySquare },
      ],
    },
    {
      title: 'LAB TOOLS',
      links: [
        { name: 'Virtual Arduino Lab', href: '/simulation', icon: Cpu },
        { name: 'Hardware Kits', href: '/inventory', icon: Box },
      ],
    },
  ],
};

export const PORTAL_ROLE_LABELS = {
  student: { name: 'Student', subtitle: 'Learning Portal', icon: GraduationCap },
  trainer: { name: 'Trainer', subtitle: 'Teaching Workspace', icon: Video },
};
