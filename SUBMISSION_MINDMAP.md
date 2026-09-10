# Pixiu Tech LMS — School Submission Mind Map

```mermaid
mindmap
  root((PIXIU LMS — TOMORROW SUBMISSION))
    Frontend stability
      Toasts visible above modals
      Auth timeout + retry
      No fake success states
      Role-based sidebar/routes
      Empty states when DB is empty
    Student workflow
      Add student
        Validate school + class + roll
        Save to PostgreSQL
        Return one-time initial password
        Keep school/class identity in response
      Student records
        School scoped
        Class scoped
        Active/inactive lifecycle
        Edit student profile data
        Keep Student ID + class canonical
      Student PDF
        Live attendance
        Live assessments
        Live projects
        Pixiu Tech branded transcript
        Certificate mode only after verified issuance
    Academic workflow
      Classes & Sessions
        Scope by school/trainer
        Safe 404 for cross-school detail
        Attendance tied to session/class
        Completed session locks attendance
      Curriculum
        Admin authoring
        Class assignment
        Trainer/student consumption
      Quiz
        Server grading
        Attempt limits
        No answer leakage
    Trainer review & certification
      Publish six unit evaluations
      Check 6/6 completion
      Trainer school-assignment permission
      Issue graduate certificate from server
      Record certificate issuance in audit log
      Generate official certificate report
      QR points to pixiutech.com/verify
    Public certificate verification
      /verify page is public
      Enter Student ID
      Open QR verification URL
      Read server-authoritative registry
      Show verified / not verified
      Show student + school + class
      Show completion + attendance
      Show assessments + projects
      Print / Save verified certificate
    Project workflow
      Create project
      Add evidence/photo
      Save evidence to DB + storage
      Display cover/photo after reload
      Student own-project restriction
      Trainer/admin evaluation
    Hardware / Kits
      New kit
      Optional class can be blank
      Image picker + preview
      Multipart save
      DB record survives refresh
      Persistent object storage for production
    Billing
      Contracts
      Invoices
      Payments + receipts
      Server-calculated totals
      Branded invoice PDF
      School cannot create admin-only records
      Clear empty contract state
    Notifications
      Server-backed delivery
      Role/audience scoping
      Read / read-all endpoints
      Optional polling for near-real-time UX
    Performance / data safety
      School performance scoped by school
      Trainer assignments visible in portal shape
      Avoid cross-school leakage
      Reduce duplicate API loads
      Avoid N+1 queries
    Deployment / production
      CORS env configured in Render
      CSRF trusted origins
      HTTPS / security settings
      Render cold-start handling
      Persistent S3/R2 media storage
      DB connection health
    Verification gate
      Django check
      deploy check
      migrations check
      certificate routes
      70+ backend tests
      compileall
      frontend build/lint
      production smoke test
```

## Submission gate

**Must be green before school demo:** login → role dashboard → add/edit student → create class/session → attendance → quiz → trainer review → certificate issue → QR `/verify` → project/evidence → billing/invoice PDF → kit image flow → notifications → reload and verify saved data.

**Known external checks:** Render/Vercel environment variables, deployed commit, live CORS/CSRF, persistent object storage and production smoke testing cannot be proven from repository source alone; verify these in the deployment dashboards before the live demo.
