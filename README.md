# Pixiu Tech — Website

Multi-page marketing site for Pixiu Tech LLP. React 18 + Vite + React Router.

**Pages:** Home · Solutions · Curriculum · Partnership · About · Contact (+ 404)

---

## Run it

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build
```

Node 18+ required. The build in `dist/` is already generated — you can upload that folder as-is.

---

## Three things to do before going live

### 1. Connect the enquiry form

`src/components/EnquiryForm.jsx` validates and confirms, but does **not** send anywhere. Find the
marked block near the bottom of `send()` and replace the `console.log` with a POST to your endpoint:

```js
await fetch('https://formspree.io/f/YOUR_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(values),
})
setSent(true)
```

Formspree, Basin, or a Google Apps Script endpoint all work without a backend. If you'd rather push
straight into a CRM, the `values` object already matches the field names in your brief:
`school, person, phone, email, city, strength, message`.

### 2. Replace the images

Every image is a placeholder technical plate in `public/img/`. They're SVGs drawn in the brand
palette so the site looks finished today — swap them for real photographs whenever you have them.

| File | Used on | Replace with |
|---|---|---|
| `lab-plan.svg` | Home hero | Wide shot of a working lab, students at benches |
| `lab-setup.svg` | Solutions | Bench / storage / fabrication area detail |
| `robotics.svg` | Solutions | Students with a robotics build |
| `circuit.svg` | Solutions | Electronics or IoT work in progress |
| `curriculum.svg` | Curriculum | Optional — the diagram may be worth keeping |
| `classroom.svg` | Curriculum, About | Instructor mid-session with a class |
| `partnership.svg` | Home, Partnership | Before/after of an actual room |

Drop the new file into `public/img/` with the same name and it appears everywhere that image is
used. Different name? Update the `src` in the relevant page under `src/pages/`. Landscape, roughly
16:10, 1600px wide or larger.

### 3. Add real contact details

Phone, email and address aren't on the site yet — no invented details were used anywhere. Add them
in `src/pages/Contact.jsx` (the `.contact__aside` block) and `src/components/Footer.jsx`.

---

## Editing copy

Almost all text lives in **`src/data/site.js`** — capabilities, the five-stage cycle, learning
areas, curriculum stages, the seven-step journey, and the "Why Pixiu" points. Edit there and it
updates on every page that uses it. Page-specific headings and paragraphs are in the page files
under `src/pages/`.

## Design system

Tokens are at the top of `src/styles/global.css`:

- **Navy** `#0A1A33` — base field
- **Electric blue** `#1D6EFF` — action and emphasis
- **White / light gray** `#FFFFFF` / `#F3F6FA` — surfaces
- **Gold** `#C9A227` — reserved for student presence and end-states only, never decoration

Type: **Archivo** (expanded, display) · **IBM Plex Sans** (body) · **IBM Plex Mono** (labels,
indices, data). Loaded from Google Fonts in `index.html`.

## Deploying

`vercel.json`, `netlify.toml` and `public/_redirects` are included — all three route unknown paths
back to `index.html` so deep links like `/curriculum` work on refresh.

- **Netlify / Vercel:** connect the repo, build command `npm run build`, publish directory `dist`
- **Any static host:** upload the contents of `dist/`, and configure the SPA fallback to
  `index.html` (otherwise only the homepage will load on direct visit)

## Phase 0: Resource Hub Architecture & How to Upload Materials

As part of Phase 0, a **Resource Hub** has been added to the site (`/hub`). This section allows users to view materials class-wise, with different views for Teachers (can download packs and answer keys) and Students (view-only watermarked books).

### Architecture (Phase 0)

Currently, the site is a static React application without a backend database. The Resource Hub works via a flat-file JSON structure.
- **Data Source**: `src/data/materials.js` serves as the database for the curriculum.
- **File Storage**: The actual PDF/Video files should be placed inside `public/materials/`.
- **UI Logic**: `src/pages/Hub.jsx` reads `materials.js` and filters them based on the selected Grade and Role (Teacher vs Student).

### How to Upload Materials (Class-wise)

To add new materials (Student Books, Teacher Packs, Answer Keys, Videos) from your side without a developer, follow these steps:

1. **Prepare your files**:
   - Create your PDFs or materials.
   - Example: `grade-1-mission-1-student.pdf` and `grade-1-mission-1-teacher.pdf`.

2. **Upload to the website folder**:
   - Move or copy your files into the `public/materials/` folder in this repository.
   - *(If the `materials` folder doesn't exist inside `public`, create it).*

3. **Update the Curriculum Database**:
   - Open `src/data/materials.js` in a text editor.
   - Under `export const MATERIALS`, find the appropriate grade array (e.g., `'grade-1'`).
   - Add a new block for your material:
     ```javascript
     {
       id: 'unique-id-for-mission',
       title: 'Mission Title',
       type: 'book', // or 'video', 'bundle'
       studentUrl: '/materials/your-student-file.pdf',
       teacherUrl: '/materials/your-teacher-file.pdf',
     }
     ```
   - Save the file. The changes will instantly reflect in the Resource Hub on the website.

4. **IP Protection Strategy**:
   - When preparing `studentUrl` files, export them as **view-only** and apply a **watermark** with the school name before dropping them in the `public/materials/` folder.
   - Leave the sensitive session packs and answer keys exclusively linked in the `teacherUrl`. The Hub hides these buttons when viewed in "Student" mode.

## SEO

Title and meta description are set in `index.html` per your brief. For per-page titles later, add
`react-helmet-async` — or pre-render with `vite-plugin-ssg` if you want each route served as static
HTML for better indexing.
