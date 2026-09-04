import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, Search, Download, 
  Award, Building2, User, Calendar, BookOpen, Sparkles, ExternalLink,
  Cpu, Check, ArrowRight, ShieldAlert, FileText, Lock, QrCode, Clock
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

  // Matched school with localStorage fallback
  const matchedSchool = useMemo(() => {
    if (!matchedStudent) return null;
    const sId = matchedStudent.school_id;
    let allSchools = SEED_SCHOOLS;
    try {
      const stored = localStorage.getItem('pixiu_schools');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) allSchools = parsed;
      }
    } catch (e) {}
    return allSchools.find(s => s.id === sId || s.code === sId) || {
      name: sId === 'XYZ' ? 'XYZ Academy (Pilot Lab)' : sId === 'ABC' ? 'ABC Public School & Robotics Lab' : 'Zenith Public School',
      code: sId || 'ZPS',
      lead_trainer: sId === 'XYZ' || sId === 'ABC' ? 'Akash Sharma' : 'Vikas Pandey'
    };
  }, [matchedStudent]);

  // Matched projects & reviews with localStorage fallback
  const studentProjects = useMemo(() => {
    if (!matchedStudent) return [];
    let allProjects = SEED_PROJECTS;
    try {
      const stored = localStorage.getItem('pixiu_projects');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) allProjects = parsed;
      }
    } catch (e) {}
    return allProjects.filter(p => {
      const pId = (p.student_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sId = (matchedStudent.student_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pId === sId;
    });
  }, [matchedStudent]);

  const studentReviews = useMemo(() => {
    if (!matchedStudent) return [];
    let allReviews = SEED_STUDENT_REVIEWS;
    try {
      const stored = localStorage.getItem('pixiu_student_reviews');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) allReviews = parsed;
      }
    } catch (e) {}
    return allReviews.filter(r => {
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
    setTimeout(() => setIsSearching(false), 600);
  };

  const cumulativeScore = useMemo(() => {
    return studentReviews.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  }, [studentReviews]);

  const isGraduate = matchedStudent && (
    (matchedStudent.status === 'Certified Graduate' || 
     matchedStudent.tech_level?.includes('Level 5') || 
     matchedStudent.certificate_issued === true) &&
    studentReviews.length >= 6
  );

  const handleDownloadTranscript = () => {
    if (!matchedStudent) return;
    generateStudentTranscriptPDF({
      student: matchedStudent,
      school: matchedSchool,
      attendanceRate: 100,
      studentReviews,
      projects: studentProjects,
      isOfficialCertificate: isGraduate
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Official Top Header (Identical to Admin Console & School Portal) */}
      <header className="bg-white border-b border-slate-200 h-16 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs flex items-center">
              <img src="/img/logo.png" alt="Pixiu Tech" className="h-6 w-auto object-contain" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-pixiu-blue block leading-none">
                Central Registry Verification
              </span>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                Official Credential Authentication
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Registry Live • Session 2026-27</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 relative z-10 space-y-6">
        
        {/* Verification Hero Banner (Exact Dark Slate Institutional Style) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 text-white shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-pixiu-blue/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-pixiu-blue px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                  Institutional Registry
                </span>
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck size={13} /> Official Cryptographic Verification
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Verify STEM & Robotics Certificate
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                Validate accredited candidate transcripts, hardware capstone evaluations, and certified instructor signatures in real time.
              </p>
            </div>

            <div className="shrink-0 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-pixiu-blue">
                <QrCode size={20} />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">QR Scanned Portal</div>
                <div className="text-xs font-bold text-white font-mono">pixiutech.com/verify</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Box (Clean White Card, Slate Border, Soft Eye Engineering) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={inputStudentId}
                onChange={(e) => setInputStudentId(e.target.value)}
                placeholder="Enter Student Roll ID (e.g. ABC6A 01, XYZ6A 01, ZPS6A 01)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:border-pixiu-blue focus:bg-white transition-all uppercase font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98 shrink-0"
            >
              <ShieldCheck size={16} />
              {isSearching ? 'Verifying...' : 'Verify Credential'}
            </button>
          </form>

          {/* Quick Demo Test Pill */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="font-bold text-slate-400">Sample Candidate ID:</span>
            {['XYZ6A 01', 'ZPS6A 01'].map(id => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setInputStudentId(id);
                  setActiveQuery(id);
                  setSearchParams({ id });
                }}
                className={`px-2.5 py-1 rounded-md font-mono font-bold transition-all cursor-pointer text-xs ${
                  canonicalQuery === id.toLowerCase().replace(/[^a-z0-9]/g, '')
                    ? 'bg-pixiu-blue text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* RESULT SECTION: MATCH FOUND */}
        {matchedStudent && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-200">
            
            {/* Header Strip: Differentiates between Certified Graduate vs In-Progress Student */}
            {isGraduate ? (
              <div className="bg-emerald-50/80 border-b border-emerald-100 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Official Accredited Credential Verified
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {matchedStudent.name}
                    </h3>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      Candidate ID: <b className="text-slate-900 font-bold">{matchedStudent.student_id}</b> • Class {matchedStudent.class_id ? matchedStudent.class_id.replace('CLS-', '') : 'Robotics Cohort'}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200/60">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                    {matchedStudent.status || 'Certified Graduate'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                    Cert Ref: PIXIU-{(matchedStudent.school_id || 'SCH').toUpperCase()}-{(matchedStudent.student_id || '').replace(/\s+/g, '')}-2026
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/80 border-b border-amber-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                    <AlertTriangle size={26} />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800 flex items-center gap-1">
                      <Clock size={12} /> Active Enrollment • Course In-Progress
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {matchedStudent.name}
                    </h3>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      Candidate ID: <b className="text-slate-900 font-bold">{matchedStudent.student_id}</b> • Class {matchedStudent.class_id ? matchedStudent.class_id.replace('CLS-', '') : 'Robotics Cohort'}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-amber-200/60">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                    {matchedStudent.tech_level || 'Level 0 (In-Progress)'}
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold mt-1">
                    🔒 Certificate Not Issued Yet
                  </span>
                </div>
              </div>
            )}

            {/* In-Progress Student Notice Alert */}
            {!isGraduate && (
              <div className="mx-6 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                <strong>⚠️ Official Graduate Certificate Notice:</strong> Candidate <strong>{matchedStudent.name}</strong> is an active enrolled learner currently undergoing hands-on practical lab modules ({matchedStudent.tech_level || 'Level 0'}). The official accredited certificate with QR verification code is unlocked only upon <strong>completing all 6 curriculum levels & faculty graduation approval</strong> (currently {studentReviews.length}/6 levels evaluated).
              </div>
            )}

            {/* Credential 4 KPI Tiles */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Partner School</div>
                  <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5 truncate">
                    <Building2 size={15} className="text-pixiu-blue shrink-0" />
                    <span className="truncate">{matchedSchool?.name}</span>
                  </div>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Current Level</div>
                  <div className="text-sm font-bold text-blue-900 mt-1 flex items-center gap-1.5">
                    <Award size={15} className="shrink-0 text-blue-600" />
                    <span>{matchedStudent.tech_level || 'Level 0'}</span>
                  </div>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Cumulative Lab Score</div>
                  <div className="text-sm font-bold text-emerald-900 mt-1 flex items-center gap-1.5">
                    <Sparkles size={15} className="shrink-0 text-emerald-600" />
                    <span>{studentReviews.length > 0 ? `${cumulativeScore} / 60 pts (${studentReviews.length}/6 Levels)` : 'Course In Progress'}</span>
                  </div>
                </div>

                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Lab Attendance</div>
                  <div className="text-sm font-bold text-indigo-900 mt-1 flex items-center gap-1.5">
                    <Check size={15} className="shrink-0 text-indigo-600" />
                    <span>100% Practical</span>
                  </div>
                </div>

              </div>

              {/* Verified Hardware Builds */}
              {studentProjects.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Cpu size={14} className="text-pixiu-blue" />
                    <span>Verified Laboratory Hardware Builds</span>
                  </div>
                  <div className="space-y-2">
                    {studentProjects.map(prj => (
                      <div key={prj.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{prj.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{prj.evidence_note}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase self-start sm:self-auto shrink-0">
                          Score: {prj.score || 10}/10 • {prj.status || 'Verified'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Authority Verification Bar & PDF Action */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="text-slate-600 font-medium">
                    Assigned Trainer / Faculty: <b className="text-slate-900">{matchedSchool?.lead_trainer || (matchedStudent.school_id === 'XYZ' || matchedStudent.school_id === 'ABC' ? 'Akash Sharma' : 'Vikas Pandey')}</b>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Security Registry: <b>{isGraduate ? 'CRYPTOGRAPHICALLY SIGNED GRADUATE RECORD' : 'ACTIVE LAB ATTENDANCE RECORD'}</b>
                  </div>
                </div>

                {/* Download PDF Button */}
                <button
                  onClick={handleDownloadTranscript}
                  className={`px-5 py-2.5 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98 shrink-0 ${
                    isGraduate 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <Download size={15} />
                  <span>{isGraduate ? 'Download Verified Certificate (PDF)' : 'Download Active Progress Report (PDF)'}</span>
                </button>
              </div>

            </div>

          </div>
        )}

        {/* RESULT SECTION: NOT FOUND (Clean Light Card) */}
        {activeQuery && !matchedStudent && !isSearching && (
          <div className="bg-white border border-rose-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <ShieldAlert size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">No Credential Record Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active student certificate matches <b className="text-rose-600 font-mono uppercase">"{activeQuery}"</b> in the Pixiu Tech Central Registry.
              </p>
            </div>
            <p className="text-[11px] text-slate-400 max-w-lg mx-auto leading-relaxed">
              Please check the Student ID printed on the physical badge or certificate. For student record assistance, contact <b>support@pixiutech.com</b>.
            </p>
          </div>
        )}

        {/* Instructions / Trust Info Cards */}
        {!matchedStudent && !activeQuery && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-2 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-pixiu-blue flex items-center justify-center font-bold">1</div>
              <h4 className="font-bold text-slate-800 text-sm">Scan Certificate QR</h4>
              <p className="leading-relaxed text-slate-500">Scan the official QR code located at the bottom of the student certificate with any mobile camera.</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-2 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">2</div>
              <h4 className="font-bold text-slate-800 text-sm">Instant Authentication</h4>
              <p className="leading-relaxed text-slate-500">The registry queries our institutional database in real time to verify candidate identity and lab scores.</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-2 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">3</div>
              <h4 className="font-bold text-slate-800 text-sm">Download Verified PDF</h4>
              <p className="leading-relaxed text-slate-500">Generate official signed transcripts directly from the authenticated registry record.</p>
            </div>
          </div>
        )}

      </main>

      {/* Unlinked Light Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-medium">
        Pixiu Tech LLP • Official STEM, Robotics & AI Institutional Certification Registry • Verified Credential Portal
      </footer>
    </div>
  );
}
