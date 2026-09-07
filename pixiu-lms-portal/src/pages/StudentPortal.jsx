import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { CLASS_KITS } from '../data/classKits';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';
import { 
  Award, BookOpen, Activity, FileText, Download, CheckCircle, 
  Clock, LogOut, User, Box, PlaySquare, Eye, Sparkles, Megaphone, 
  Bell, Check, X, Star, ShieldCheck, CheckCircle2, ChevronRight, Send, Trash2,
  Cpu, Maximize2, Zap, Layers, Info, List, LayoutGrid, PackageCheck, MessageCircle, ShoppingBag, PhoneCall,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import { filterNotificationsForUser, fetchUserReadNotifIds, saveUserReadNotifIds, getCanonicalUserKey } from '../utils/notifications';
import QuizPreExamModal from '../components/quiz/QuizPreExamModal';
import QuizExamEngine from '../components/quiz/QuizExamEngine';
import QuizResultSheetModal from '../components/quiz/QuizResultSheetModal';

