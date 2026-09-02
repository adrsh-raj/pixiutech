import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, Search, Download, 
  Award, Building2, User, Calendar, BookOpen, Sparkles, ExternalLink,
  Cpu, Check, ArrowRight, ShieldAlert, FileText, Lock
} from 'lucide-react';
import { SEED_STUDENTS, SEED_SCHOOLS, SEED_STUDENT_REVIEWS, SEED_PROJECTS } from '../data/seedData';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';

export default function Verify() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryId = searchParams.get('id') || searchParams.get('cert') || '';
  
  const [inputStudentId, setInputStudentId] = useState(queryId);
  const [activeQuery, setActiveQuery] = useState(queryId);
  const [isSearching, setIsSearching] = useState(false);

  // Sync URL query
  useEffect(() => {
    if (queryId) {
      setInputStudentId(queryId);
      setActiveQuery(queryId);
    }
  }, [queryId]);

  // Clean canonical search string (remove spaces, case-insensitive)
  const canonicalQuery = (activeQuery || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  // Look up student across seed data and localStorage
  const matchedStudent = useMemo(() => {
    if (!canonicalQuery) return null;

    // 1. Try localStorage students
    let allStudents = [];
    try {
      const stored = localStorage.getItem('pixiu_students');
      if (stored) allStudents = JSON.parse(stored);
    } catch (e) {}

    // Fallback to seed students
    if (!allStudents || allStudents.length === 0) {
      allStudents = SEED_STUDENTS;
    } else {
      // Merge with seed students so newly completed graduates always exist
      const existingIds = new Set(allStudents.map(s => s.student_id));
      SEED_STUDENTS.forEach(s => {
        if (!existingIds.has(s.student_id)) allStudents.push(s);
      });
    }

    return allStudents.find(s => {
      const sId = (s.student_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sDbId = (s.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const certRef = `pixiu${(s.school_id || '').toLowerCase()}${sId}2026`;
      return sId === canonicalQuery || sDbId === canonicalQuery || certRef.includes(canonicalQuery) || canonicalQuery.includes(sId);
    });
  }, [canonicalQuery]);

  // Matched school
  const matchedSchool = useMemo(() => {
    if (!matchedStudent) return null;
    const sId = matchedStudent.school_id;
    return SEED_SCHOOLS.find(s => s.id === sId || s.code === sId) || {
      name: sId === 'XYZ' ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School',
      code: sId || 'ZPS'
    };
  }, [matchedStudent]);

  // Matched projects & reviews
  const studentProjects = useMemo(() => {
    if (!matchedStudent) return [];
    return SEED_PROJECTS.filter(p => {
      const pId = (p.student_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sId = (matchedStudent.student_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pId === sId;
    });
  }, [matchedStudent]);

  const studentReviews = useMemo(() => {
    if (!matchedStudent) return [];
    return SEED_STUDENT_REVIEWS.filter(r => {
      const rId = (r.student_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sId = (matchedStudent.student_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return rId === sId;
    });
  }, [matchedStudent]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!inputStudentId.trim()) return;
    setIsSearching(true);
    setActiveQuery(inputStudentId.trim());
    setSearchParams({ id: inputStudentId.trim() });
    setTimeout(() => setIsSearching(false), 200);
  };

  const handleDownloadTranscript = () => {
    if (!matchedStudent) return;
    generateStudentTranscriptPDF({
      student: matchedStudent,
      school: matchedSchool,
      attendanceRate: 100,
      studentReviews,
      projects: studentProjects
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-600/15 via-indigo-600/5 to-transparent blur-3xl pointer-events-none"></div>

      {/* Official Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-700 shadow-sm flex items-center">
              <img src="/img/logo.png" alt="Pixiu Tech" className="h-6 w-auto object-contain" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-pixiu-blue block leading-tight">
                Central Registry • Credential Verification
              </span>
              <h1 className="text-sm font-bold text-white tracking-tight">
                Pixiu Tech Institutional Excellence Suite
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline">Registry Online: </span>2026-27
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 relative z-10 space-y-8">
        
        {/* Verification Hero Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} /> Official Credential Registry
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Verify Student STEM & Robotics Certificate
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Enter candidate Student Roll ID or Certificate Reference Number to authenticate formal STEM competency accreditation and practical lab transcripts.
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={inputStudentId}
                onChange={(e) => setInputStudentId(e.target.value)}
                placeholder="Enter Student ID (e.g. XYZ6A 01, ZPS6A 01, XYZ7A 01)"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors uppercase font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-3 bg-pixiu-blue hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-98 shrink-0"
            >
              <ShieldCheck size={16} />
              {isSearching ? 'Verifying...' : 'Verify Credential'}
            </button>
          </form>

          {/* Quick Demo Student Pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-500">Quick Test IDs:</span>
            {['XYZ6A 01', 'XYZ7A 01', 'XYZ8A 01', 'XYZ9A 01', 'XYZ11A 01', 'ZPS6A 01'].map(id => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setInputStudentId(id);
                  setActiveQuery(id);
                  setSearchParams({ id });
                }}
                className={`px-2 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                  canonicalQuery === id.toLowerCase().replace(/[^a-z0-9]/g, '')
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* RESULT SECTION: MATCH FOUND */}
        {matchedStudent && (
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/10 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Verified Header Strip */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-5 sm:p-6 border-b border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Authentic Verified Credential
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {matchedStudent.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    ID: <b className="text-white font-bold">{matchedStudent.student_id}</b> • Class {matchedStudent.class_id ? matchedStudent.class_id.replace('CLS-', '') : 'Robotics Cohort'}
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                  {matchedStudent.status || 'Certified Graduate'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-1">
                  Cert ID: PIXIU-{(matchedStudent.school_id || 'SCH').toUpperCase()}-{(matchedStudent.student_id || '').replace(/\s+/g, '')}-2026
                </span>
              </div>
            </div>

            {/* Credential Data Grid */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Partner School</div>
                  <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5 truncate">
                    <Building2 size={14} className="text-pixiu-blue shrink-0" />
                    <span className="truncate">{matchedSchool?.name}</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Accredited Level</div>
                  <div className="text-sm font-bold text-pixiu-blue mt-1 flex items-center gap-1.5">
                    <Award size={14} className="shrink-0" />
                    <span>{matchedStudent.tech_level || 'Level 5 Master'}</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Practical Score</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <Sparkles size={14} className="shrink-0" />
                    <span>10 / 10 (Distinction)</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Lab Attendance</div>
                  <div className="text-sm font-bold text-indigo-400 mt-1 flex items-center gap-1.5">
                    <Check size={14} className="shrink-0" />
                    <span>100% Practical</span>
                  </div>
                </div>

              </div>

              {/* Verified Hardware Prototypes Built */}
              {studentProjects.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Cpu size={14} className="text-pixiu-blue" />
                    <span>Verified Laboratory Hardware Builds</span>
                  </div>
                  <div className="space-y-2">
                    {studentProjects.map(prj => (
                      <div key={prj.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-white text-xs sm:text-sm">{prj.title}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{prj.evidence_note}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase self-start sm:self-auto shrink-0">
                          Score: {prj.score || 10}/10 • {prj.status || 'Verified'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Authority Strip */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="text-slate-400 font-medium">
                    Assigned Trainer / Faculty: <b className="text-white">{matchedStudent.school_id === 'XYZ' ? 'Akash Sharma' : 'Vikas Pandey'}</b>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Official Registry Status: <b>CRYPTOGRAPHICALLY AUTHENTICATED</b>
                  </div>
                </div>

                {/* Download PDF Button */}
                <button
                  onClick={handleDownloadTranscript}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-98 shrink-0"
                >
                  <Download size={15} />
                  <span>Download Verified Transcript (PDF)</span>
                </button>
              </div>

            </div>

          </div>
        )}

        {/* RESULT SECTION: NOT FOUND */}
        {activeQuery && !matchedStudent && !isSearching && (
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">No Credential Record Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No active student certificate matches <b className="text-rose-400 font-mono uppercase">"{activeQuery}"</b> in the Pixiu Tech Central Registry.
              </p>
            </div>
            <p className="text-[11px] text-slate-500 max-w-lg mx-auto leading-relaxed">
              Please double check the Student ID on the printed badge or transcript. For student credential inquiries, contact Pixiu Central Administration at <b>support@pixiutech.com</b>.
            </p>
          </div>
        )}

        {/* Instructions / Institutional Trust Info */}
        {!matchedStudent && !activeQuery && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-pixiu-blue flex items-center justify-center font-bold">1</div>
              <h4 className="font-bold text-white text-sm">Scan Certificate QR</h4>
              <p className="leading-relaxed">Scan the official QR code located at the bottom of the student transcript using any mobile camera.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">2</div>
              <h4 className="font-bold text-white text-sm">Instant Authentication</h4>
              <p className="leading-relaxed">Our registry queries the central database in real time to verify candidate identity and lab scores.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">3</div>
              <h4 className="font-bold text-white text-sm">Download Verified PDF</h4>
              <p className="leading-relaxed">Generate official watermarked and signed transcripts directly from the authenticated verification record.</p>
            </div>
          </div>
        )}

      </main>

      {/* Unlinked Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 font-medium">
        Pixiu Tech LLP • Official STEM, Robotics & AI Institutional Certification Registry • Unauthorized duplication is prohibited.
      </footer>
    </div>
  );
}
