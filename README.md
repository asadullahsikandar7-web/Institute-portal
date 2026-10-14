# ACADEXA — Institute Management Platform

One system for a school, college or university to run **everything** — admissions, classes, attendance, exams, results, fees, payroll, library, hostel, transport and communication — with a separate portal for administrators, teachers, students and parents, and an intelligence layer that tells each of them what needs their attention today.

---

## The problem

Most institutes are not run on a system. They are run on a *pile* of them:

- **Admissions** live in a paper file and a spreadsheet. Nobody can say how many applicants are at which stage, or who should be offered a seat first.
- **Attendance** is a register the teacher carries. By the time a parent learns their child has missed three weeks, the term is half over.
- **Fees** are tracked in the accountant's own Excel sheet. Part payments, scholarships, late fees and "I paid at the bank yesterday" are reconciled by hand, and the defaulter list is always out of date.
- **Timetables and exam datesheets** are built by one overworked coordinator moving cells around until the clashes *seem* to be gone — then a teacher is discovered in two rooms at once.
- **Results** are computed in a different spreadsheet per teacher, with different rounding, then retyped into transcripts.
- **Salaries, library loans, hostel beds, bus seats, certificates** — each has its own notebook and its own person who "knows how it works".

The cost of this is not just wasted hours. It is that **nobody sees the whole picture**. The student who is failing two courses, has stopped attending and has an unpaid fee is three separate rows in three separate files owned by three people who never compare notes — so the institute finds out when the student drops out.

## What ACADEXA does about it

**1. One record, entered once.** A student is created once (by admissions, in bulk from a CSV, or by hand) and every module — enrolment, attendance, coursework, exams, fees, library, hostel, transport, certificates — hangs off that one record. The *Student 360* screen shows all of it on one page.

**2. The system does the clerical work, with rules a human can read.**

| Chore | What the platform does instead |
|---|---|
| Building the weekly timetable | Generates it: no teacher, section or room double-booked, rooms large enough, each section's week spread out. Shown as a preview; nothing is saved until accepted. |
| Building the exam datesheet | Generates it: one paper per section per day where possible, rooms sized to the class, Sundays and calendar holidays skipped, invigilators assigned, seats numbered — then prints seating plans. |
| Deciding who may sit an exam | Checked live when the student opens their admit card: attendance in that subject and fee clearance. Paying the fee unlocks the card instantly — nobody "re-issues" anything. |
| Billing a semester | One click bills a whole program or section from a fee structure, applies each student's scholarships automatically, and can never double-bill a period. |
| Reconciling bank deposits | Students or parents report a payment with its reference; it waits in a verification queue and is credited, with a receipt, only when the accounts office confirms it. |
| Taking attendance | The teacher shows a 6-digit code that changes every 30 seconds; students in the room mark themselves present from their own phones. |
| Marking quizzes | Multiple-choice quizzes are taken online against a server-side timer and marked automatically, with per-question statistics for the teacher. |
| Computing GPA | Teachers enter marks against a weighted scheme; percentage, grade, grade points, term GPA and CGPA follow from the institute's own grading scale. |
| Running payroll | One click generates every payslip from salary structure and that month's staff attendance, and books the total into the finance ledger. |
| Finding cover for an absent teacher | Lists every period they'd miss with colleagues who are genuinely free then (not teaching, not covering, not on leave), best fit first — one click assigns and notifies them. |
| Chasing people | **Automations** tell a parent the same day their child is absent, remind before a fee falls due and when it goes overdue, chase library books, escalate newly high-risk students to their teachers and close stale tickets — each at most once, never twice. |
| Spotting copied assignments | A similarity check compares every pair of submissions for an assignment and points the teacher at the pairs worth reading side by side. |
| Splitting a fee | A family that can't pay a semester at once gets an instalment plan in one step; the parts always add up exactly. |
| Booking parent–teacher meetings | Teachers publish short slots; parents book one with their child's teacher from the parent portal — no phone tag. |

**3. It notices what people miss.** The **early-warning engine** scores every student from five signals the system already holds — attendance, results, overdue fees, missing coursework and discipline records — and lists who is at risk, *with the reasons in plain words* ("Attendance 58% — below the required 75%"). It is a transparent rule-based score, not a black box, so staff can explain it to a parent. Staff log what they did about it, and the list shows who is at high risk with no follow-up at all.

**4. Everyone sees their own "today".** Each dashboard opens with a *Needs your attention* list — for a student: work due, a quiz that is open, a fee that is overdue; for a teacher: classes with no attendance yet, submissions to grade, their students at risk; for an admin: payment claims to verify, applications to review, urgent tickets. Every row links to where the thing gets done.

**5. Parents are inside the loop, not at the end of it.** A parent signs in and sees each child's attendance by subject, published results and GPA, fees and upcoming work — and can report a fee payment or raise a ticket without visiting the campus.

---

## What's inside

**Four portals** — Admin (with staff sub-roles), Teacher, Student, Parent — plus two public pages: an online admission form (`/apply`) and certificate verification (`/verify`).

| Area | Features |
|---|---|
| **Admissions** | Public application form with status tracking · staged pipeline · weighted merit score · one-click enrolment that creates the student, the parent record and the section placement |
| **Academics** | Sessions, programs, sections, subjects, teacher assignments · rooms & facilities · **auto-generated clash-free timetable** · academic calendar |
| **Attendance** | Per-subject attendance · **live check-in codes** · staff attendance · minimum-attendance policy |
| **Teaching & learning** | Assignments with student submission, grading, feedback and **similarity (copying) check** · **online auto-graded quizzes** · class chat groups · video class calls · announcements |
| **Examinations** | **Auto-generated datesheets with rooms, invigilators and seating** · admit cards with live eligibility · weighted gradebook · configurable grading scale · GPA/CGPA · publish control · merit lists · printable transcripts · anonymous teacher evaluation |
| **Student success** | **Early-warning risk engine** with stated reasons · intervention log · Student 360 view · degree progress (credits earned vs required) · discipline, health and achievement records |
| **Finance** | Fee structures · bulk billing · scholarships · part payments with printable receipts · waivers · late fees · **instalment plans** · **payment-claim verification** · defaulter reminders by email · expenses · income/expense reports · month-end collection forecast |
| **HR & payroll** | Departments · staff records · attendance-linked payroll · payslips · staff leave · **substitute-cover finder** · teachers see their own payslips and cover duties |
| **Campus services** | Library (catalogue, loans, fines) · transport routes with seat limits · hostel rooms with bed limits · asset inventory · visitor log |
| **One-click suggestions** | A **Suggestions** button on Classes, Sections, Subjects, Sessions, Rooms, Departments and the Academic Calendar shows ready-made lists for the institute's level — Playgroup to Class 10 and O/A Levels for schools, FSc / ICS / I.Com / ADP for colleges, BS / MS / PhD programs for universities, the Pakistani curriculum subjects for each stage, and Pakistan's public and Islamic holidays dated from today. Tap what applies (or "Select all" on a group) and add everything at once; anything already added is ticked. Classes can get section "A" automatically, and a new institute's first session is created on the fly |
| **CSV import everywhere** | Every data screen has **Import CSV**: download a template with a sample row (linked fields pre-filled with your own classes, roll numbers and sessions), fill it in Excel, preview every row with its problems before saving, then download any rows that failed with an Error column to fix and re-upload. Covers sessions, classes, sections, subjects, teachers (logins generated), teacher assignments, timetable, rooms, calendar, fees, fee structures, scholarships, expenses, staff, staff attendance & leave, admissions, parents, library, transport, hostel, assets, records, certificates, alumni — and for teachers, class attendance and gradebook marks |
| **People lifecycle** | CSV bulk import · end-of-term promotion and graduation · alumni directory · serial-numbered, publicly verifiable certificates |
| **Communication** | Notification inbox · helpdesk tickets · **parent–teacher meeting booking** · parent messaging · support chat · **AI assistant** that can answer from live data ("who is at risk?", "what is my GPA?") |
| **Automation** | Six scheduled rules (absence alerts, fee due / overdue, library due, risk escalation, ticket clean-up) — off until switched on, idempotent, run hourly or from a cron |
| **Insights** | Attendance by weekday and by week, grade distribution, weakest subjects with pass rates, enrolment by programme, admissions funnel, fee forecast |
| **System & security** | Institute settings and policies · staff sub-roles (registrar, accountant, librarian, HR, warden, front desk) · **two-factor sign-in for admins** (any authenticator app) · **forgot-password by email** for every portal · audit log of every change · login throttling · command palette (`Ctrl/⌘ + K`) |

---

## Serving many institutes from one platform

ACADEXA is **multi-tenant**: one deployment and one database serve any number of schools, colleges and universities, and none of them can see another's data.

- **Isolation is enforced in one place, below every feature.** Every record carries its institute, and a database layer (`backend/src/tenancy/`) adds "this institute only" to every read, count, update, delete, report and bulk write, and stamps every new record. Work with no institute attached is refused rather than allowed through. A route can't forget the filter, because routes never apply it themselves.
- **The institute comes from the signed-in user's token**, so it can't be swapped by a browser. Before sign-in it comes from the institute code on the login page, a `?i=CODE` link, or a subdomain (`riverside.yourdomain.com`).
- **Identifiers are unique per institute.** Two schools can both have roll number `CS-201`, an admin email, or receipt `RCP-000001`.
- **Plans.** The platform owner decides which optional modules each institute has (finance, payroll, library, exams, AI assistant…) and its student and teacher limits. Modules outside the plan disappear from the menus and are refused by the API.
- **Platform owner console at `/platform`.** Create an institute together with its first admin, set plan, modules, limits and subscription date, see usage and last activity, suspend or reactivate it (data is kept), recover a locked-out admin, and copy its login link.
- **Chat, class calls, scheduled automations and uploads** all run inside the right institute too.

### Turning an existing installation into institute #1

Until the first institute exists, the server runs in **single-institute mode**, exactly as before. To switch on multiple institutes for a database that already has data:

```bash
cd backend
# 1. back up the database (Atlas: Backup → Take Snapshot)
node scripts/migrateToMultiTenant.mjs --code MAIN --name "Your Institute"            # dry run: shows what will change
node scripts/migrateToMultiTenant.mjs --code MAIN --name "Your Institute" --apply    # assigns all records, updates indexes
node scripts/createPlatformOwner.mjs you@example.com 'a-long-password'               # your owner login for /platform
```

Then set `DEFAULT_INSTITUTE_CODE=MAIN` in `backend/.env`, so your existing users keep signing in without a code, and add new institutes from `/platform`. For subdomains, point a wildcard domain (`*.yourdomain.com`) at the app and set `PLATFORM_DOMAIN` (backend) and `VITE_PLATFORM_DOMAIN` (web build). The migration can be re-run safely.

## Try it in one command

You need **Node 20+** and **MongoDB** installed locally (`brew install mongodb-community` on macOS).

```bash
npm install
npm install --prefix backend
npm run demo
```

This starts a private MongoDB in `./.demo`, fills it with a complete demo institute, runs the API and the web app, and prints the address to open. **It never touches the database configured in `backend/.env`** and cannot send email.

### Test logins (demo)

| Role | Login | Password | What to look at |
|---|---|---|---|
| **Admin** (full) | `admin.demo@demo.acadexa.test` | `AcadexaDemo#2026` | Dashboard → *Needs your attention*, Command Center, Student Success, Fee Collection, Exams & Datesheets, Class Schedule → *Generate Timetable* |
| Accountant | `accounts.demo@demo.acadexa.test` | `Demo@Staff2026` | A limited sub-role: only finance and payroll are visible and permitted |
| Librarian | `library.demo@demo.acadexa.test` | `Demo@Staff2026` | A limited sub-role: only the library |
| **Teacher** | `ahmed.khan@demo.acadexa.test` | `Demo@Teach2026` | My Classes → a class → *Attendance* (live check-in), *Gradebook*, *Assignments* (grade submissions); Students at Risk; Payslips |
| **Student** (top of class) | roll no `DEMO-BSAI-A-001` | `Demo@Stu2026` | Dashboard, the open online quiz, Exams & Admit Card, Results & Transcript, Fees (receipts) |
| Student (at risk) | roll no `DEMO-BSAI-A-002` | `Demo@Stu2026` | The same screens from the other side: withheld admit card, overdue fees, low attendance |
| **Parent** | `shazia.yousuf@demo.acadexa.test` | `Demo@Parent2026` | Parent of the at-risk student — attendance, results, fees, *I've paid this* |
| Parent | `naveed.fatima@demo.acadexa.test` | `Demo@Parent2026` | Parent of the top student |
| **Platform owner** | `owner@demo.acadexa.test` | `Demo@Owner2026` | Open **`/platform`**. All institutes, usage, plans; create one, suspend one |
| Second institute admin | `admin@riverside.demo.acadexa.test` | `Demo@Riverside2026` | On the login page click **Change** → code **`RIVERSIDE`**. A school on the basic plan: only its own 6 students, no library/HR/payroll |

The demo has two institutes. **DEMO** is the default, so its users need no code; for **RIVERSIDE** enter the code first. One Riverside student has the same roll number as a DEMO student, to show identifiers are per institute. On the login page pick the matching role tab first. Students sign in with their **roll number**; everyone else with email.

More to try: *Insights*; *Substitute Cover* (pick Bilal Hassan and a weekday); *Automations* → *Run now*; *Settings → My Security* to turn on two-factor sign-in; as a parent, *Teacher Meetings* to book a slot; as a teacher, *Assignments → Submissions & Grading → Check for copying*.

A good two-minute tour: sign in as the **teacher**, open *Data Structures — A* → *Attendance* → **Start Check-in**; in a second browser window sign in as the **student** and type the code shown. Then sign in as **admin**, open **Student Success** and click *Hamza Yousuf*.

`npm run demo -- --keep` restarts without re-seeding, so changes you made are kept.

---

## Running it for real

```bash
# 1. API  (http://localhost:5001)
cd backend
cp .env.example .env        # set MONGO_URI and JWT_SECRET at minimum
npm run dev

# 2. Web app  (http://localhost:5173)
npm run dev
```

On first start against an empty database the API creates a default admin (`admin1@uni.edu`, password `admin123`); **change its password immediately and turn on two-factor sign-in** (*Settings → My Security*).

Optional environment variables in `backend/.env`: `FRONTEND_URL` (used in password-reset links), `CRON_SECRET` (lets Vercel Cron call `/api/automations/cron` daily — already scheduled in `vercel.json`; on an always-on server the automations run hourly by themselves), and the `SMTP_*` settings for email. Then, in order: *Settings* (institute name, grading scale, policies) → *Sessions* → *Programs & Sections* → *Subjects* → *Teachers* → *Teacher Assignments* → *Rooms* → add or import students → *Class Schedule → Generate Timetable*.

To load the demo institute into your own database instead (every record is tagged and removable): `npm run seed:demo --prefix backend`, and `npm run seed:demo:reset --prefix backend` to remove it again.

### Useful commands

| Command | What it does |
|---|---|
| `npm run demo` | Local demo with its own database (see above) |
| `npm run dev` / `npm run build` | Web app dev server / production build |
| `npm run dev --prefix backend` | API with auto-reload |
| `npm run test:smoke --prefix backend` | ~200 end-to-end API checks. Starts its own server against a **local** MongoDB on port 27099 and refuses to run against anything else |
| `npm run seed:demo --prefix backend` | Add the tagged demo dataset to the database in `backend/.env` |

---

## How it is built

```
src/                     React 18 + Vite single-page app
  features/admin|teacher|student   the original portals
  features/erp/                    ERP + smart-layer screens (lazy-loaded)
  components/resource/             config-driven list/form page used by ~25 screens
backend/
  server.js                        Express app (also deployable as a Vercel function)
  src/routes/                      one router per module
  src/models/                      Mongoose models (Erp.js, Smart.js hold the newer ones)
  src/services/
    risk.js                        early-warning scoring
    planner.js                     timetable + exam datesheet solvers
    automations.js                 scheduled follow-up rules
  src/tenancy/                     institute isolation: request context, database plugin, sockets
    security.js                    TOTP two-factor + password-reset tokens
    permissions.js                 staff sub-roles, audit trail, rate limiting
    notify.js · payments.js        notifications, the single payment-recording path
    aiTools.js · aiToolsErp.js     what the AI assistant is allowed to read and do
  scripts/                         demo seed, smoke test
```

**Stack:** React 18, React Router, Vite · Node 20, Express, MongoDB (Mongoose) · Socket.IO for chat and class calls · JWT auth · Nodemailer.

### Design decisions worth knowing

- **Access is decided on the server, from the token.** A teacher reaches a class only through a teacher-assignment they hold; a student only through their own enrolment; a parent only through children linked to them. Ids sent by the browser are never trusted on their own.
- **Staff sub-roles are enforced in one place** (`permissions.js`) by mapping URL prefixes to modules, so a librarian cannot waive a fee even by calling the API directly.
- **Money has one write path.** Collecting at the counter, "mark paid" and approving a reported payment all go through `payments.js`, so every credit gets a receipt and balances can't drift.
- **Nothing derived is stored if it can go stale.** Risk scores, exam eligibility and fee balances are computed from live data on request.
- **Generators preview before they write.** The timetable and datesheet solvers are pure functions; the admin sees what would happen — including what could *not* be placed and why — before anything is saved.
- **The audit log records who changed which fields — never the values**, so it can't become a second copy of passwords, marks or bank details.
- **Automations are off until someone turns them on**, because some contact parents — and every action is recorded under a key so a rule can never send the same message twice.
- **Two-factor sign-in is standard TOTP** (RFC 6238, checked against the RFC test vectors), with replay protection; turning it off needs both the password and a current code. Password-reset links are single-use, expire in 30 minutes, and only their hash is stored.
- **Anonymous means anonymous.** Teacher-evaluation responses hold no student reference; a keyed hash prevents double answers, and a teacher sees results only once at least three students have responded.

### Known limits

- No online payment gateway — payments are recorded at the counter or reported with a bank reference and verified.
- No SMS/WhatsApp sending (email and in-app notifications only).
- Assignment submissions are text or a link, not file uploads.
- Login throttling is per server instance; on a serverless host it slows password guessing rather than strictly capping it.
- Real-time chat and class calls need a long-running server — they do not run on a serverless-only deployment.

---

© 2026 Asad Ullah Sikandar. All rights reserved.
