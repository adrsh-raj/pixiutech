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

For DRF, authentication/permission checks occur before the view body, and object permissions must be paired with queryset filtering for list endpoints. See the DRF authorization guidance: https://www.django-rest-framework.org/api-guide/permissions/

## 8. Credential management

### Admin

- Admin accounts are bootstrapped only from environment-provided credentials.
- No default admin password exists in application code.
- Admin can create/reset school and trainer credentials through protected endpoints.

### School

- Username will be the database-backed school code/ID once the School domain model exists.
- Minimum managed password length: 8 characters.
- Admin-set/reset credentials force a password change on next login.

### Trainer

- Username will be the database-backed trainer ID once the Trainer domain model exists.
- Minimum managed password length: 12 characters.
- Admin-set/reset credentials force a password change on next login.

### Student

Student credentials are generated only from authoritative database relationships once School → Class → Student exists.

Student username format:

`[SCHOOL_CODE][GRADE][SECTION] [ROLL_NO_2_DIGITS]`

Example: `XYZ8A 03`

Student password format implemented by the credential service:

`[UPPERCASE_SCHOOL_CODE][COMPACT_STUDENT_USERNAME_WITH_LOWERCASE_SCHOOL_PREFIX][@hata]`

Example: `XYZ8A 03` → `XYZxyz8A3@hata`

The generator is a backend utility. The React frontend must never construct or invent student credentials.

## Security boundary

Authentication answers **who are you?**

Authorization answers **what may you do?**

Domain scope answers **which records may you access?**

All three layers are required. Hiding a frontend control is not considered an authorization mechanism.
