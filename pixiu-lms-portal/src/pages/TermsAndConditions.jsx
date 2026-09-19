import { Link } from 'react-router-dom';
import PortalFooter from '../components/PortalFooter';

const LAST_UPDATED = '19 September 2026';

const sections = [
  {
    title: '1. Website and portal use',
    content: [
      'The Pixiu Tech website, public certificate-verification service, and Learning Management Portal are provided for legitimate education, programme, administrative, support, and related business purposes.',
      'You must not use the services for unlawful activity, to interfere with the service, to bypass security controls, or to submit false, harmful, or misleading information.',
    ],
  },
  {
    title: '2. Portal accounts',
    content: [
      'Portal access is provided only to authorised users such as students, trainers, schools, and administrators. Keep your password, PIN, and authentication information confidential.',
      'Do not share an account, impersonate another user, or attempt to access records belonging to another student, school, trainer, or administrator.',
    ],
  },
  {
    title: '3. Learning records',
    content: [
      'The portal may contain attendance, assessments, quiz results, projects, progress reports, certificates, and other educational records. Access is controlled by role and school relationships.',
      'Authorised users must use student and school information only for legitimate programme, educational, administrative, or support purposes.',
    ],
  },
  {
    title: '4. Certificate verification',
    content: [
      'Pixiu Tech may expose a limited public verification page so a third party can confirm whether a credential was issued. Public verification is not a substitute for confidential academic records or authenticated portal access.',
    ],
  },
  {
    title: '5. Intellectual property',
    content: [
      'Unless stated otherwise, Pixiu Tech owns or licenses the portal interface, software, branding, curriculum materials, documents, and other protected content. You receive a limited right to use the service for its intended purpose.',
      'Do not copy, republish, resell, reverse engineer, or commercially redistribute protected materials without permission, except where applicable law permits otherwise.',
    ],
  },
  {
    title: '6. Third-party services',
    content: [
      'The service may rely on third-party infrastructure and tools for hosting, security, authentication, communication, payments, file delivery, and other functionality. Those providers may have their own terms and privacy notices.',
    ],
  },
  {
    title: '7. Availability and security',
    content: [
      'We work to keep the portal secure and available, but no online service is guaranteed to be uninterrupted or completely free of defects. Access may be temporarily suspended for maintenance, security investigations, service changes, or circumstances beyond our reasonable control.',
    ],
  },
  {
    title: '8. Prohibited activity',
    items: [
      'Do not probe, scan, attack, or attempt to bypass security controls.',
      'Do not upload malicious code, unlawful content, or content that infringes another person’s rights.',
      'Do not scrape or systematically collect restricted portal data or another user’s personal information.',
      'Do not use the service to impersonate Pixiu Tech, a school, a trainer, or another user.',
    ],
  },
  {
    title: '9. Suspension and termination',
    content: [
      'We may restrict, suspend, or terminate access when reasonably necessary to protect the service, enforce these Terms, respond to security incidents, comply with law, or act on instructions from an authorised school or account administrator.',
    ],
  },
  {
    title: '10. Changes, governing law, and contact',
    content: [
      'We may update these Terms when our services, contracts, or legal obligations change. The latest version will be published on this page.',
      'These Terms are intended to be interpreted under the laws applicable in India, subject to mandatory legal requirements that apply to a particular user or contract.',
    ],
  },
];

export default function TermsAndConditions() {
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
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Terms & Conditions</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Pixiu Tech LMS · Last updated {LAST_UPDATED}</p>
          </div>

          <p className="text-[15px] leading-7 text-slate-600">
            These Terms govern use of the Pixiu Tech website, public certificate-verification service, and Learning Management Portal.
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
            <strong>Legal contact:</strong>{' '}
            <a href="mailto:director@pixiutech.com" className="font-bold underline underline-offset-2">director@pixiutech.com</a>
          </div>

          <p className="mt-8 text-xs leading-5 text-slate-400">
            Partner-school agreements, employment arrangements, purchase orders, or other written contracts may contain additional terms for a particular relationship.
          </p>
        </article>
      </main>

      <PortalFooter />
    </div>
  );
}
