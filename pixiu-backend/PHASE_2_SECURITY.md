# PIXIU Tech — Phase 2 Security Contract

Phase 2 establishes the authentication, authorization, and credential-management rules that later academic/business modules must follow.

## 6. Authentication

- Django uses the custom `accounts.User` model.
- API authentication uses JWT Bearer access tokens.
- Access and refresh token lifetimes are environment-configurable.
- Refresh tokens rotate and are blacklisted after rotation.
- Logout blacklists the supplied refresh token.
- Password changes/reset operations revoke all outstanding refresh tokens for that account.
- Login is public but throttled by a scoped login rate.
- Inactive/suspended accounts cannot log in and active API endpoints also check account status.
- Passwords are written using Django's password hashing API; plaintext passwords are never stored or returned.

## 7. Role and action authorization

The platform has four roles:

| Role | Baseline actions | Scope |
|---|---|---|
| Admin | VIEW, CREATE, EDIT, DELETE, PUBLISH, ASSIGN, GRADE, RATE, EXPORT | Platform-wide |
| School | VIEW, CREATE, EDIT, EXPORT | Own school only; relationship scope is enforced by domain querysets/objects |
| Trainer | VIEW, CREATE, EDIT, GRADE, RATE | Assigned schools/classes/students only; assignments are relational |
| Student | VIEW, CREATE | Own account, class and explicitly assigned learning data only |

The action vocabulary is intentionally broader than HTTP verbs:

`VIEW`, `CREATE`, `EDIT`, `DELETE`, `PUBLISH`, `ASSIGN`, `GRADE`, `RATE`, `EXPORT`

A domain view opts into the required action with `required_action`. Domain-specific queryset/object checks must additionally enforce school/class/student scope. This prevents a trainer from seeing another school's records simply because the trainer is authenticated.

## 8. Credential management

### Admin

- Admin accounts are bootstrapped only from environment-provided credentials.
- No default admin password exists in application code.
- Admin can create/reset school and trainer credentials through protected endpoints.
- Admin can run the one-time student credential migration. The migration creates a fresh temporary PIN for each active student with a linked student account and downloads an Excel-compatible CSV credential sheet.
- The credential sheet is a sensitive operational artifact: it must be kept private and distributed only to the corresponding student.

### School

- Username will be the database-backed school code/ID once the School domain model exists.
- Minimum managed password length: 8 characters.
- Admin-set/reset credentials force a password change on next login.

### Trainer

- Username will be the database-backed trainer ID once the Trainer domain model exists.
- Minimum managed password length: 12 characters.
- Admin-set/reset credentials force a password change on next login.
- A trainer may reset a student only when the student is inside the trainer's active school assignment scope.
- Trainer reset generates a fresh temporary 8-digit PIN and never reveals the student's permanent password.

### Student

Student usernames remain generated only from authoritative database relationships:

`[SCHOOL_CODE][GRADE][SECTION] [ROLL_NO_2_DIGITS]`

Example: `XYZ8A 03`

Student passwords are no longer derived from the username, school code, roll number, or a fixed suffix.

Every newly provisioned student receives a cryptographically secure **8-digit numeric temporary PIN**. Existing active students receive a fresh temporary PIN during the admin credential migration.

Example:

`XYZ8A 03` → temporary PIN `58319427`

The backend uses Django password hashing for the PIN/password value. The plaintext temporary PIN exists only in the controlled creation/reset/migration response so an authorized administrator/trainer can physically provide it to the student.

While the student is using a temporary PIN, `must_change_password` remains true. After login the student is shown a password-security prompt:

- **Set permanent password** — the student chooses a private password and `must_change_password` becomes false.
- **Continue with PIN** — the temporary PIN remains a valid password and the reminder is shown again on the next fresh student login.

A student who knows their current password/PIN can use the own-account password-change endpoint by supplying the current password and a new password. No trainer/admin access is needed for this self-change operation.

If a student forgets the current password/PIN, the login page provides a **Forgot password?** route that tells the student to contact their assigned trainer. The portal does not expose trainer contact information through this recovery route.

The trainer password-reset page generates a new random temporary PIN for an in-scope student. The old password is invalidated and outstanding refresh sessions are revoked. The trainer gives the new PIN to the student physically; the trainer never receives or sees the student's permanent password.

The React frontend must never construct or derive student credentials. Credential generation and reset rules live on the backend.

## 9. Credential security tests

Phase 2 must verify at minimum:

- Deterministic student password generation is removed.
- Temporary student PINs are 8 numeric digits and are generated with a cryptographically secure source.
- Existing student migration gives every active linked student a new temporary PIN and invalidates the old password.
- Student A cannot access Student B's reset operation or data.
- A trainer cannot reset a student outside the trainer's active school assignment scope.
- A student can change their own password only by proving the current password/PIN.
- Password change/reset revokes outstanding refresh tokens.
- Login throttling remains enabled.
- Student login/profile responses do not expose password hashes or permanent credentials.
- Forgot-password guidance does not expose trainer contact data.

## Security boundary

Authentication answers **who are you?**

Authorization answers **what may you do?**

Domain scope answers **which records may you access?**

Credential management answers **how are secrets issued, changed, and recovered?**

All four layers are required. Hiding a frontend control is not considered an authorization mechanism.
