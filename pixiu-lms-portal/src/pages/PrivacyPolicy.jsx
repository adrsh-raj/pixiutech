import { Link } from 'react-router-dom';

const LAST_UPDATED = '19 September 2026';

const sections = [
  {
    title: '1. Information we collect',
    content: [
      'The portal processes account and authentication information and education-related records such as student or staff names, student IDs, school and class information, attendance, sessions, quizzes, practical assessments, trainer reviews, projects, certificates, and related learning activity.',
      'When a certificate is checked through the public verification service, the verification page may display limited credential information such as the learner name, student ID, school, class, programme, score, issue date, certificate ID, technologies completed, and the public ranking band where applicable.',
      'Normal hosting, CDN, browser, and security infrastructure may generate technical request data needed to deliver and protect the service. Our backend audit system records IP address and user-agent information for certain auditable actions, including authenticated portal activity. Cloudflare Turnstile may be used as an anti-abuse measure during login.',
    ],
  },
  {
    title: '2. How we use information',
    items: [
      'Create and manage authorised accounts and login sessions.',
      'Deliver school programmes and maintain attendance, class, assessment, quiz, project, and progress records.',
      'Issue, maintain, and verify Pixiu Tech certificates.',
      'Support students, trainers, schools, and programme administrators.',
      'Protect the portal from fraud, abuse, and unauthorised access.',
      'Maintain, troubleshoot, and improve the service and meet applicable obligations.',
    ],
  },
  {
    title: '3. How information is shared',
    content: [
      'We do not sell or rent personal information. Information may be shared with authorised personnel of a partner school when required for programme operations, with technology or service providers that host, secure, deliver, or support the service, or when disclosure is required by law or necessary to protect our rights, users, or the service.',
      'Public certificate verification is intentionally limited so that a third party can validate a credential without receiving access to the authenticated LMS.',
    ],
  },
  {
    title: '4. Schools, students, and minors',
    content: [
      'Pixiu Tech programmes may involve students who are minors. Depending on the arrangement and applicable law, Pixiu Tech may process student information on behalf of a partner school or educational institution. Schools remain responsible for their own notices, permissions, and lawful instructions concerning student information.',
      'Parents or guardians with questions about a student record should normally contact the relevant partner school first and may also contact Pixiu Tech where appropriate.',
    ],
  },
  {
    title: '5. Cookies, storage, and security',
    content: [
      'The portal may use essential cookies, browser storage, or similar mechanisms to maintain secure login sessions, necessary preferences, and service functionality. Limited performance diagnostics may be recorded to help identify reliability or loading issues.',
      'We use administrative, technical, and organisational safeguards intended to protect information, but no internet service can guarantee absolute security. Never share your password or login credentials with another person.',
    ],
  },
  {
    title: '6. Data retention',
    content: [
      'Information is retained for as long as reasonably necessary to deliver programmes, maintain academic and certificate records, provide support, meet contractual requirements, resolve disputes, and comply with applicable law. Information that is no longer required may be deleted, anonymised, or securely disposed of.',
    ],
  },
  {
    title: '7. Your choices and requests',
    content: [
      'Depending on your relationship with Pixiu Tech and applicable law, you may request access to, correction of, or deletion of personal information, or ask how your information is being used. We may need to verify identity and coordinate with the relevant partner school before acting on a student-data request.',
    ],
  },
  {
    title: '8. Changes and contact',
    content: [
      'We may update this Privacy Policy when our services, data practices, or legal obligations change. The latest version will always be published on this page.',
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-[#070B14] text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/login" className="flex items-center gap-3" aria-label="Back to Pixiu Tech login">
            <span className="rounded-lg bg-white px-2 py-1"><img src="/img/logo.png" alt="Pixiu Tech" className="h-7 w-auto" /></span>
            <span className="hidden text-xs font-black tracking-[0.18em] sm:inline">PIXIU TECH PORTAL</span>
          </Link>
          <a href="https://pixiutech.com" className="text-xs font-bold text-slate-300 transition hover:text-white">pixiutech.com</a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:p-12">
          <div className="mb-8 border-b border-slate-100 pb-6">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600">Legal</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Pixiu Tech LMS · Last updated {LAST_UPDATED}</p>
          </div>

          <p className="text-[15px] leading-7 text-slate-600">
            Pixiu Tech LLP operates pixiutech.com and the Pixiu Tech Learning Management Portal. This page explains how information is handled within the portal and its public certificate-verification service.
          </p>

          <div className="mt-9 space-y-9">
            {sections.map(section => (
              <section key={section.title}>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl">{section.title}</h2>
                {section.content?.map(paragraph => (
                  <p key={paragraph} className="mt-3 text-[15px] leading-7 text-slate-600">{paragraph}</p>
                ))}
                {section.items && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-600">
                    {section.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <strong>Privacy contact:</strong>{' '}
            <a href="mailto:director@pixiutech.com" className="font-bold underline underline-offset-2">director@pixiutech.com</a>
          </div>

          <p className="mt-8 text-xs leading-5 text-slate-400">
            This notice describes Pixiu Tech's product practices at a practical level. Partner-school contracts and applicable legal requirements may impose additional obligations or rights for particular programmes.
          </p>
        </article>
      </main>
    </div>
  );
}
