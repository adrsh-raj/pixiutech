import PageHead from '../components/PageHead.jsx'
import '../styles/legal.css'

const LAST_UPDATED = '19 September 2026'

export default function TermsAndConditions() {
  return (
    <>
      <PageHead
        crumb="Legal"
        title="Terms & Conditions"
        intro="The terms that apply when you use the Pixiu Tech website, public certificate verification service, and Learning Management Portal."
      />

      <section className="band legal-page">
        <div className="shell">
          <article className="legal-doc">
            <div className="legal-meta">Last updated: {LAST_UPDATED}</div>

            <p>
              These Terms & Conditions ("Terms") govern your use of <strong>pixiutech.com</strong>,
              the Pixiu Tech Learning Management Portal at <strong>portal.pixiutech.com</strong>,
              and the public certificate-verification service operated by Pixiu Tech LLP
              ("Pixiu Tech", "we", "us", or "our"). By using these services, you agree to these Terms.
            </p>

            <section>
              <h2>1. Website use</h2>
              <p>
                You may use the public website to learn about Pixiu Tech, contact us, request proposals,
                apply for listed roles, and access public resources that we make available. You must not
                use the website for unlawful activity, to interfere with the service, to attempt to gain
                unauthorised access, or to submit false, harmful, or misleading information.
              </p>
            </section>

            <section>
              <h2>2. Learning Portal accounts</h2>
              <p>
                Portal access is provided only to authorised users such as students, trainers, schools,
                and administrators. You are responsible for keeping your password, PIN, and other
                authentication information confidential and for activity performed through your account.
              </p>
              <p>
                You must not share an account, impersonate another person, bypass access controls, or
                attempt to access records belonging to another student, school, trainer, or administrator.
              </p>
            </section>

            <section>
              <h2>3. School and student records</h2>
              <p>
                The Portal may contain educational records supplied or created during a school programme,
                including attendance, assessments, quiz results, projects, progress reports, and
                certificates. Access to those records is controlled by role and school relationships.
                Schools and authorised users must use student information only for legitimate programme,
                educational, administrative, or support purposes.
              </p>
            </section>

            <section>
              <h2>4. Certificate verification</h2>
              <p>
                Pixiu Tech may provide a public certificate-verification page so third parties can check
                whether a credential was issued. The public verification service is a limited verification
                tool and is not a substitute for confidential academic records or authenticated portal
                access.
              </p>
              <p>
                Certificate IDs, verification links, marks, ranking information, and related credential
                data must not be altered, misrepresented, or used to impersonate Pixiu Tech or another
                credential holder.
              </p>
            </section>

            <section>
              <h2>5. Intellectual property</h2>
              <p>
                Unless expressly stated otherwise, the Pixiu Tech website, portal interface, branding,
                logos, curriculum materials, software, content, documents, and other materials are owned
                by Pixiu Tech or its licensors. We grant you a limited, non-exclusive right to use the
                services and materials for their intended purpose. You may not copy, resell, republish,
                reverse engineer, or commercially redistribute protected materials without permission,
                except where applicable law permits otherwise.
              </p>
            </section>

            <section>
              <h2>6. Third-party services</h2>
              <p>
                Our services may rely on third-party infrastructure or tools for hosting, security,
                authentication, communication, analytics or diagnostics, payments, file delivery, or
                other functionality. Third-party services may have their own terms and privacy notices.
                We are not responsible for changes or outages originating solely from a third-party
                provider.
              </p>
            </section>

            <section>
              <h2>7. Educational and service information</h2>
              <p>
                Pixiu Tech aims to provide accurate programme, curriculum, progress, and service
                information, but educational schedules, content, features, availability, and programme
                details may change. Progress and assessment information is based on records available in
                the LMS and may depend on timely attendance, assessment, or trainer inputs.
              </p>
            </section>

            <section>
              <h2>8. Availability and security</h2>
              <p>
                We work to keep the services secure and available, but no online service can be
                guaranteed to be uninterrupted or completely free of defects. We may temporarily suspend
                access for maintenance, security investigations, service changes, or circumstances beyond
                our reasonable control.
              </p>
            </section>

            <section>
              <h2>9. Acceptable use and prohibited activity</h2>
              <ul>
                <li>Do not probe, scan, attack, or attempt to bypass security controls.</li>
                <li>Do not upload malicious code, unlawful content, or content that infringes another person's rights.</li>
                <li>Do not scrape, harvest, or systematically collect restricted portal data or another user's personal information.</li>
                <li>Do not use the services to impersonate Pixiu Tech, a school, a trainer, or another user.</li>
              </ul>
            </section>

            <section>
              <h2>10. Suspension or termination</h2>
              <p>
                We may restrict, suspend, or terminate access where reasonably necessary to protect the
                service, enforce these Terms, respond to security incidents, comply with law, or act on
                instructions from an authorised school or account administrator.
              </p>
            </section>

            <section>
              <h2>11. Liability</h2>
              <p>
                To the extent permitted by applicable law, Pixiu Tech provides the services on an
                "as available" basis and is not responsible for indirect or consequential loss arising
                solely from use of the services. Nothing in these Terms excludes or limits liability that
                cannot lawfully be excluded or limited.
              </p>
            </section>

            <section>
              <h2>12. Changes to these Terms</h2>
              <p>
                We may update these Terms when our services, contracts, or legal obligations change.
                The latest version will be published on this page with a revised "Last updated" date.
              </p>
            </section>

            <section>
              <h2>13. Governing law and contact</h2>
              <p>
                These Terms are intended to be interpreted under the laws applicable in India, subject to
                any mandatory protections or jurisdictional requirements that apply to a particular user
                or contract.
              </p>
              <p>
                Questions about these Terms may be sent to <a href="mailto:director@pixiutech.com">director@pixiutech.com</a>.
              </p>
            </section>

            <aside className="legal-note">
              <strong>Important:</strong> Partner-school agreements, employment arrangements, purchase
              orders, or other written contracts may contain additional terms that apply to a particular
              relationship. Where a signed contract expressly conflicts with these website Terms for a
              specific transaction, the applicable contract governs that transaction to the extent stated.
            </aside>
          </article>
        </div>
      </section>
    </>
  )
}
