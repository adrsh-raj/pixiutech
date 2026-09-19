import PageHead from '../components/PageHead.jsx'
import '../styles/legal.css'

const LAST_UPDATED = '19 September 2026'

export default function PrivacyPolicy() {
  return (
    <>
      <PageHead
        crumb="Legal"
        title="Privacy Policy"
        intro="How Pixiu Tech collects, uses, protects, and shares information across pixiutech.com, certificate verification, and the Pixiu Tech Learning Management Portal."
      />

      <section className="band legal-page">
        <div className="shell">
          <article className="legal-doc">
            <div className="legal-meta">Last updated: {LAST_UPDATED}</div>

            <p>
              Pixiu Tech LLP ("Pixiu Tech", "we", "us", or "our") operates <strong>pixiutech.com</strong>
              and the Pixiu Tech Learning Management Portal at <strong>portal.pixiutech.com</strong>.
              This Privacy Policy explains what information we collect, why we use it, and the choices
              available to people who use these services.
            </p>

            <section>
              <h2>1. Information we collect</h2>
              <h3>Website and enquiries</h3>
              <p>
                When you contact us or request a proposal, we may collect the school name, contact
                person's name, phone number, email address, city, approximate student strength, and the
                message or other information you choose to submit.
              </p>
              <h3>Career applications</h3>
              <p>
                Career submissions may include your name, email address, phone number, the position you are
                applying for, your application message, and the PDF CV/resume you choose to upload. CV files
                are restricted to PDF uploads up to 2 MB and are kept in a private application storage path
                for authorised recruitment review rather than being published as public website content.
              </p>
              <h3>Learning portal records</h3>
              <p>
                The portal may process account and authentication information and education-related
                records such as student or staff names, student IDs, school and class information,
                attendance, sessions, quizzes, practical assessments, trainer reviews, projects,
                certificates, and related learning activity.
              </p>
              <h3>Certificate verification</h3>
              <p>
                Our public verification service is designed to confirm whether a certificate was issued.
                A valid verification link or certificate ID may display limited credential information,
                such as the learner's name, student ID, school, class, programme, score, issue date,
                certificate ID, technologies completed, and the public ranking band where applicable.
              </p>
              <h3>Technical and security information</h3>
              <p>
                Normal hosting, CDN, browser, and security infrastructure may also generate technical request data needed to deliver and
                protect the services. Our backend audit system also records IP address and user-agent information
                for certain auditable actions, including website enquiries and authenticated portal activity. The portal may
                use Cloudflare Turnstile as an anti-abuse measure during login.
              </p>
            </section>

            <section>
              <h2>2. How we use information</h2>
              <ul>
                <li>To respond to enquiries, proposals, support requests, and career applications.</li>
                <li>To create and manage portal accounts and authenticate authorised users.</li>
                <li>To deliver school programmes, record attendance and assessments, manage projects, and provide learning progress information.</li>
                <li>To issue, maintain, and verify Pixiu Tech certificates and related records.</li>
                <li>To communicate with authorised schools, trainers, students, and other service users about programme operations.</li>
                <li>To prevent fraud, abuse, unauthorised access, and other security incidents.</li>
                <li>To maintain, troubleshoot, and improve our services, and to meet applicable legal or contractual obligations.</li>
              </ul>
            </section>

            <section>
              <h2>3. How information is shared</h2>
              <p>We do not sell or rent personal information.</p>
              <p>
                Information may be shared with authorised personnel of a partner school when it is
                needed to operate that school's programme, with technology or service providers that
                help us host, secure, deliver, or support the services, or where disclosure is required
                by law or necessary to protect our rights, users, or the service.
              </p>
              <p>
                Public certificate verification is intentionally different from authenticated portal
                access: the verification page can expose only the credential information described above
                so a third party can validate a certificate.
              </p>
            </section>

            <section>
              <h2>4. Schools, students, and minors</h2>
              <p>
                Some Pixiu Tech programmes are delivered through schools and may involve students who
                are minors. Depending on the relationship and applicable law, Pixiu Tech may process
                student information on behalf of a partner school or educational institution. Schools
                remain responsible for their own notices, permissions, and lawful instructions concerning
                student information.
              </p>
              <p>
                Parents or guardians who have a question about a student's information should normally
                contact the relevant partner school first, and may also contact Pixiu Tech using the
                details below where appropriate.
              </p>
            </section>

            <section>
              <h2>5. Website visits, cookies, storage, and similar technologies</h2>
              <p>
                We may use essential cookies, browser storage, or similar mechanisms to keep the portal
                secure, maintain login sessions, remember necessary preferences, and support service
                functionality. The public website may use Google Analytics 4 for aggregate traffic and page-usage
                measurement. Analytics storage is denied by default and advertising/personalisation signals are
                disabled; this configuration is intended to avoid Google Analytics cookies while still allowing
                basic measurement signals. Browser controls can also be used to block or delete cookies. The portal
                records limited performance diagnostics to help us identify reliability or loading issues.
              </p>
            </section>

            <section>
              <h2>6. Data retention</h2>
              <p>
                We keep information for as long as it is reasonably necessary for the purpose for which
                it was collected, including delivering programmes, maintaining academic and certificate
                records, handling support matters, meeting contractual requirements, resolving disputes,
                and complying with applicable law. When information is no longer required, we may delete,
                anonymise, or securely dispose of it.
              </p>
            </section>

            <section>
              <h2>7. Security</h2>
              <p>
                We use administrative, technical, and organisational safeguards intended to protect
                information against unauthorised access, loss, misuse, or alteration. No internet service
                can guarantee absolute security, so users should also protect their credentials and avoid
                sharing passwords or one-time login information.
              </p>
            </section>

            <section>
              <h2>8. Your choices and requests</h2>
              <p>
                Depending on your relationship with Pixiu Tech and applicable law, you may request access
                to, correction of, or deletion of personal information, or ask us to explain how your
                information is being used. We may need to verify identity and may need to coordinate with
                the relevant partner school before acting on a student-data request.
              </p>
            </section>

            <section>
              <h2>9. Changes to this policy</h2>
              <p>
                We may update this Privacy Policy when our services, data practices, or legal obligations
                change. The updated version will be published on this page with a revised "Last updated"
                date.
              </p>
            </section>

            <section className="legal-contact">
              <h2>10. Contact Pixiu Tech</h2>
              <p>
                For privacy questions or requests, contact <a href="mailto:director@pixiutech.com">director@pixiutech.com</a>.
              </p>
            </section>

            <aside className="legal-note">
              <strong>Important:</strong> This notice describes Pixiu Tech's current product practices at
              a practical level. Partner-school contracts and applicable legal requirements may impose
              additional obligations or rights for particular programmes.
            </aside>
          </article>
        </div>
      </section>
    </>
  )
}
