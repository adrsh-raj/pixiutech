# PIXIU Tech Django Backend

Clean replacement backend for the PIXIU LMS.

## Stack

- Django
- Django REST Framework
- PostgreSQL via psycopg 3

## Rebuild rule

This backend starts against a fresh PostgreSQL database. Legacy Express/SQLite application data is not imported.

Business domains and authentication will be added incrementally in the numbered rebuild steps.

## Local setup

```bash
cd pixiu-backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env  # macOS/Linux
python manage.py check
python manage.py migrate
python manage.py runserver
```

`DATABASE_URL` must point to the new PIXIU Django PostgreSQL database during this rebuild.
