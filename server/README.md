# Half Coders — Backend API

The API behind **half-coders.tech**, Half Coders' coding-learning platform.
Node.js + Express 5 + TypeScript + Prisma 7 on PostgreSQL.

Half Coders is self-contained: its own accounts, its own database, nothing
shared with any other site.

- **Its own accounts.** Email + password, with the email verified by a
  six-digit code before first sign-in, and password resets by the same kind of
  code (`module/auth`, `lib/password.ts`, `lib/session.ts`, `lib/authCodes.ts`).
- **Its own database.** Every table — accounts and sessions, learning
  profiles, courses, enrolments, progress, certificates, orders… — lives in the
  `learning` schema of Half Coders' own PostgreSQL database.
- **Email only.** Codes, payment results and announcements all go by email;
  Half Coders sends no text messages. The phone number taken at sign-up is for
  the team to reach a learner.

A learner's Half Coders-specific details — student id, whether they're blocked
from learning, WhatsApp, bio, preferences — are their `LearningProfile`,
created the first time they sign in.

---

## Getting started

```bash
pnpm install
cp .env.example .env      # then fill it in — see "Environment" below
pnpm db:up                # local PostgreSQL in Docker (docker-compose.dev.yml), matching .env.example
pnpm generate             # generate the Prisma client
pnpm migrate:deploy       # create the `learning` schema and its tables
pnpm dev                  # http://localhost:5001
```

Then sign in on the web app (http://localhost:3001) as the super admin.

**What the server seeds when it starts** (`utils/seed.ts`), in order, each step
logging its own failure without blocking the boot:

1. **Platform settings** — any default that has no row yet; an admin's values stay.
2. **The first super admin** — from `SUPER_ADMIN_*`, when no account has that
   email yet. An existing account is never changed on boot (`pnpm seed:admin`
   promotes one on purpose).
3. **Starter content, once per database** — the full category catalogue
   (`utils/categoryCatalogue.ts`), the first 8 courses as drafts and the Career
   Launchpad bundle (`utils/initialCatalogue.ts`). A hidden settings row
   (`system.starterContentSeeded`) records that it's done, so a category an
   admin deletes or a course they rename stays that way across restarts.
   `pnpm seed:categories` / `seed:catalogue` add anything missing later, on purpose.

Check it's alive:

```bash
curl http://localhost:5001/health      # process is up
curl http://localhost:5001/readiness   # database is reachable too
curl http://localhost:5001/api/v1      # list of mounted endpoints
```

### Scripts

| Script | Does |
| --- | --- |
| `pnpm dev` | Run with tsx watch |
| `pnpm db:up` / `db:down` | Start / stop the local PostgreSQL container (data is kept in a Docker volume) |
| `pnpm build` | Type-check and emit to `dist/` |
| `pnpm start` | Run the built server |
| `pnpm migrate <name>` | Create a migration from schema changes (needs `SHADOW_DATABASE_URL`, an empty scratch database) |
| `pnpm migrate:deploy` / `migrate:prod` | Apply pending migrations (dev / compiled, for the image) |
| `pnpm migrate:status` | Show migration status |
| `pnpm generate` | Regenerate the Prisma client |
| `pnpm studio` | Prisma Studio |
| `pnpm lint` | ESLint |
| `pnpm seed:admin` / `seed:admin:prod` | Create the first SUPER_ADMIN from `SUPER_ADMIN_NAME` / `_EMAIL` / `_PASSWORD`, or promote an existing account with that email. Safe to re-run. (The boot creates the account too, but never promotes) |
| `pnpm seed:categories` / `seed:categories:prod` | Add any missing course categories — the boot does this once per database; this is for later |
| `pnpm seed:catalogue` / `seed:catalogue:prod` | Add Half Coders' first 8 courses (CodeBee first, the rest upcoming) and the Career Launchpad bundle; only adds what's missing. Also once per database on boot |
| `pnpm test` | Integration tests (see "Tests") |

> Regenerate the client after **any** schema edit. A stale client is the most
> confusing failure mode here — queries fail with "Unknown argument" against
> columns that plainly exist in the database.

---

## Environment

`.env.example` is the reference. Rules enforced in code
(`src/app/config/env.ts`):

- **`DATABASE_URL` ends with `?schema=learning`.** Every table and the
  migration history live in that schema; boot fails without it.
- **`AUTH_SECRET`** (at least 32 characters) keys the one-time email codes.
  Changing it invalidates any code already sent, nothing else.
- **SMTP is required** — sign-up can't be finished without the verification
  email. Without SMTP configured in development, emails are logged instead of
  sent.
- **Cloudinary** uploads are namespaced under `CLOUDINARY_FOLDER` (default
  `halfcoders`), and Half Coders only ever deletes files under it.
- **`COOKIE_DOMAIN`** (production, optional) — the parent domain when the web
  app and the API are sibling subdomains, so the session cookie reaches both.
  A bare host: `half-coders.tech`.
- **`TRUST_PROXY`** (default 1) — proxy hops in front of the API, for
  per-person rate limits and the IPs in "My devices".
- **`SUPER_ADMIN_PASSWORD`** with a `#` in it must be quoted in `.env`
  (`'...'`): dotenv reads an unquoted `#` as the start of a comment.

Sign-up only takes a real, lasting inbox: throwaway/disposable domains are
refused, and the domain must accept mail (`utils/realEmail.ts`). Edu and
business addresses are fine.

---

## Accounts and roles

Each account has one role — `STUDENT`, `MENTOR`, `ADMIN` or `SUPER_ADMIN`
(`User.role`; `lib/roles.ts`). Route guards check it:
`checkAuth(Role.STUDENT)`, `checkAuth(...ADMINS)` and so on.

| Endpoint (`/api/v1/auth`) | Does |
| --- | --- |
| `POST /register` | name, email, phone, password → account (unverified) + a code by email |
| `POST /verify-email` | the code → verified, and signed in |
| `POST /resend-verification` | a fresh code (at most once a minute) |
| `POST /login` | email + password → session cookie. An unverified account gets a fresh code and `EMAIL_NOT_VERIFIED` |
| `POST /logout` | ends this session |
| `POST /forgot-password` → `POST /reset-password` | a code by email, then a new password; every session of the account ends |
| `POST /change-password` | from inside the account; every *other* session ends |
| `GET` / `PATCH /me`, `PATCH /me/avatar`, `PATCH /me/preferences` | the signed-in account |

- Codes are six digits, valid for 15 minutes, five tries, single-use, and stored
  only as an HMAC (`lib/authCodes.ts`).
- Passwords are hashed with scrypt (`lib/password.ts`). A wrong email and a
  wrong password take the same time and give the same answer.
- The session is a random token in the httpOnly cookie
  `halfcoders.session_token` (`SameSite=Lax`, `Secure` in production, on
  `COOKIE_DOMAIN` when set), valid 30 days and extended while in use. The database keeps only its SHA-256 hash.
  Non-browser clients may send the token as `Authorization: Bearer …`.

**Staff.** The first SUPER_ADMIN is created on boot from `SUPER_ADMIN_*` (or by
`pnpm seed:admin`). Admins create
mentors (`POST /users/mentors`); only a super admin creates admins
(`POST /users/admins`). A staff account starts verified, on a temporary
password the admin chose, and must change it at first sign-in
(`needPasswordChange`). An admin can also send anyone a password-reset code
(`PATCH /users/:userId/reset-password`) — nobody ever sees the new password.
`SUPER_ADMIN` can't be granted through the API.

**Blocking.** `User.status` locks the whole account; `LearningProfile.status`
removes access to learning only. Either answers 403 with a `data.code` the web
app explains (`ACCOUNT_INACTIVE`, `LEARNING_BLOCKED`, `LEARNING_REMOVED`).

---

## Tests

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/halfcoders_test pnpm test
```

Integration tests run the real app against a PostgreSQL database they build
the way production is built: a least-privilege app role that owns only the
`learning` schema, then Half Coders' migrations applied as that role. The
database is dropped and recreated each run, so the URL must point at a local
database whose name contains `test` (anything else is refused).

---

## Architecture

```
src/
├── server.ts              bootstrap, boot seeding, graceful shutdown
├── app.ts                 express setup, security headers, CORS, route mount
└── app/
    ├── config/            env (fail-fast), cloudinary, multer, environment
    ├── lib/               prisma client (pg pool), passwords, sessions, email
    │                      codes, learning profiles, realtime, scheduler
    ├── middleware/        checkAuth, optionalAuth, validateRequest,
    │                      rateLimiter, globalErrorHandler, notFound
    ├── errorHelpers/      AppError + Prisma/Zod error mapping
    ├── shared/            catchAsync, sendResponse
    ├── utils/             QueryBuilder, progress helpers, YouTube parsing,
    │                      slugs, ordering, platform settings, bKash,
    │                      seed + the starter category/course catalogues
    └── module/            one folder per domain:
                           route → controller → service
```

Every module has the same shape: `*.route.ts` wires middleware,
`*.controller.ts` unwraps the request and formats the response, `*.service.ts`
holds all the logic and is the only layer that talks to Prisma. Validation
lives in `*.validation.ts` as Zod schemas applied by `validateRequest`.

### Where the important decisions live

**Access control** (`utils/courseAccess.ts`) — three gates, used everywhere:

- `assertCanManageCourse` — admins manage any course; a mentor only the courses
  they're assigned to. Without it, any mentor could edit a colleague's course
  by guessing its id.
- `requireCourseAccess` — returns the enrolment, or lets admins and assigned
  mentors through with `null` so they can preview what students see.
- `requireEnrollment` — insists on a real student enrolment, for progress
  writes.

**The paywall** — the public course endpoint deliberately returns video titles
and durations but *never* `youtubeUrl`. URLs only come from `/api/v1/learning`,
which runs `requireCourseAccess` first. Unlisted YouTube links are the product;
leaking them on a public page gives the course away. The single exception is a
lesson flagged `isFreePreview`: `getCourseBySlug` releases *that* lesson's
video id (and nulls every other one in a post-query pass, so the rule lives in
one place rather than in every caller's `select`).

**Course page content** — feature tiles, per-course FAQ, extra "includes"
lines and the batch start date live on `Course` as JSON / array columns. The
feature icon is a closed enum (`COURSE_FEATURE_ICONS`), not a free string or a
URL, because the client maps it to a bundled icon and the public page renders
it. Mentors edit the content fields of their own courses through
`PATCH /courses/staff/:id/content`, whose Zod schema is an explicit allow-list
— price, discount, category, level, status and the featured flags are not on
it, and `validateRequest` replaces `req.body` with the parsed object, so an
extra key in the request is dropped rather than written.

**Progress** (`module/progress/progress.service.ts`) — video → module →
milestone → course, recomputed from the underlying `VideoProgress` rows rather
than incremented. Two things this file gets right on purpose:

- All reads happen *outside* the transaction and only genuinely-changed rows are
  written. An earlier version rewrote all 40 modules inside one interactive
  transaction and blew Prisma's 5s ceiling (P2028) against a remote database —
  it failed on exactly the large courses the platform is built for.
- Publishing or unpublishing curriculum triggers
  `scheduleCourseRecalculation`, which reprocesses the cohort in batches in the
  background. Progress is derived from the *published* curriculum, so without
  this a student who finished a course before a new module landed would stay at
  100% and remain eligible for a certificate covering material they never saw.
- That scheduler runs **one pass at a time per course**, with anything arriving
  mid-flight collapsed into a single trailing re-run. Publishing a milestone,
  then its module, then its lessons is three writes in seconds; overlapping
  passes diffed against the same stale snapshot and raced each other into a
  unique-constraint failure (P2002) on the progress rows, which silently left
  every student's percentage stale. The creates also pass `skipDuplicates` as a
  second line of defence.

**XP** (`module/leaderboard/leaderboard.service.ts`) — an append-only ledger
plus a denormalised `CourseXp` total. Awards are idempotent on
`(studentId, source, refId)`, so re-marking a video complete or re-grading a
submission can't inflate the leaderboard. Awards run outside the progress
transaction: a duplicate award must never roll back progress the student
actually earned.

**Ordering** (`utils/ordering.ts`) — curriculum rows carry
`@@unique([parentId, order])`, which makes naive reordering impossible (a single
multi-row UPDATE trips the index mid-statement). Reorders run two passes inside
one transaction: park at negative placeholders, then write final positions.

**Certificate PDFs** (`utils/certificatePdf.ts`) — rendered on demand and
streamed, never written to storage. Nothing goes stale against a renamed
course, there is no bucket to pay for, and a revoked certificate simply stops
being downloadable (410) instead of leaving a valid-looking file in the world
forever. The PDF carries its own verification URL, so whoever receives it can
check it without contacting anyone.

**Money** — prices are whole Taka stored as integers, and the checkout reads the
price from the database, never from the request. A client-supplied amount would
let a student buy a ৳12,000 course for ৳1. No enrolment exists until an order
reaches `PAID`.

**Support queue** (`module/support/`) — the serial is maintained **by hand**.
The mentor finishes with a student, hits `serve-next` ("Done"), and the lowest
waiting number is promoted. Nothing advances on a timer: `slotMinutes` feeds
only the *estimated* wait shown to students, because a long question pushes
everyone back and a short one pulls them forward. The meeting itself happens in
Google Meet — we store the link and withhold it until the session is actually
live, since handing it out early lets anyone wander into the mentor's room.

A student gets one number per session; rejoining after being served or leaving
is refused rather than putting them back at the end, which would otherwise let
someone cycle the queue. Numbers are allocated with a retry on the unique
`(sessionId, queueNumber)` index, so two students pressing Join at the same
instant both get a number instead of one seeing an error.

**Real-time** (`lib/realtime.ts`) — Socket.IO shares the HTTP server and the
same session cookie, with one room per session. Sockets are authenticated on
connect; an unauthenticated one is refused rather than left sitting in a room
receiving student names and queue positions. The service calls `emitQueueUpdate`
and knows nothing else about sockets, so the REST API stays authoritative and
correct even if the socket server never started.

**Configurable by design** (`utils/platformSettings.ts`) — XP values, support
slot length, certificate prefix and sequential-learning mode are rows in
`PlatformSetting`, editable through `/api/v1/settings`, cached in-process for a
minute. The plan calls these out as tunable, so changing them must never need a
migration.

---

## API surface

Base path `/api/v1`. Auth is the session cookie above. 401 means "no usable
session" (sign in again); 403 with `data.code` `LEARNING_BLOCKED` /
`LEARNING_REMOVED` / `ACCOUNT_INACTIVE` / `ACCOUNT_UNVERIFIED` means signed in
but not allowed.

| Area | Endpoints |
| --- | --- |
| `auth` | register, verify email, sign in/out, forgot/reset/change password, `me`, profile, avatar, preferences — see "Accounts and roles" |
| `users` | student + mentor + admin management, public mentor directory |
| `categories` | public list; admin CRUD under `/manage` |
| `courses` | public catalogue + detail by slug (with per-course testimonials, related courses and free-preview lessons); admin CRUD, mentor assignment, weekly schedule under `/manage`; staff summary, full record and content edit under `/staff` |
| `milestones` `modules` `videos` | staff curriculum CRUD, reordering, bulk video import and bulk publish |
| `assignments` | staff authoring under `/manage`; student view + submit; mentor review queue and verdicts |
| `practice-days` | staff authoring under `/manage`; student mark complete / incomplete |
| `certificates` | eligibility, claim, my certificates; **public** `/verify/:certificateNo` and `/download/:certificateNo` (PDF); admin register, manual issue, revoke, restore |
| `testimonials` | public published list; admin CRUD under `/manage` |
| `stats` | `/public` — four counters for the homepage strip |
| `support` | student session list + join/leave queue + my position; mentor queue board, `serve-next`, `complete`, `skip`, history |
| `orders` | checkout, send bKash payment details (`POST /:id/bkash`), my orders; admin confirm / turn down / refund |
| `bundles` | bundle catalogue and checkout, bKash details (`POST /orders/:id/bkash`); admin confirm / turn down |
| `enrollments` | my enrolments; admin register, manual enrol, cancel, reactivate |
| `learning` | the gated course player — curriculum with progress and lock state, single video |
| `progress` | mark video complete/incomplete, save playback position, course progress |
| `leaderboard` | course board, my rank, my XP history |
| `notifications` | list, unread count, mark read, delete; admin broadcast |
| `dashboard` | `/student`, `/mentor`, `/admin` |
| `settings` | platform tunables (admin) |

Admin-only routes sit under a `/manage` prefix, declared before the public
`/:slug` route so literal segments aren't swallowed by the slug parameter.

Responses are uniform:

```jsonc
{ "success": true, "message": "...", "data": {}, "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 } }
```

List endpoints accept `?searchTerm=&page=&limit=&sortBy=&sortOrder=&fields=`
plus per-endpoint filters, including nested ranges like `?price[gte]=5000`.
Only fields an endpoint explicitly allow-lists can be filtered or sorted on —
an unrecognised `sortBy` falls back to the endpoint's default rather than
reaching Prisma, which would reject it and surface a typo as a 500.

Most models sort by `createdAt` by default; those that timestamp differently
(`AssignmentSubmission` → `submittedAt`, `Certificate` → `issuedAt`) declare
`defaultSortBy` in their `QueryBuilder` config. A new list endpoint on a model
without `createdAt` must do the same.

---

## Security notes

- Sign-up, sign-in, code and password endpoints share a strict rate limit (20
  attempts per 15 minutes); each code also allows only five tries. Asking for a
  code for an unknown email answers exactly as for a real one, so the
  endpoints can't be used to find out who has an account.
- Session tokens and email codes are never stored in the clear (SHA-256 and
  HMAC). Signing out deletes the session row, so a stolen cookie stops working
  at once; a password reset or change signs out the other sessions too.
- `SUPER_ADMIN` is not assignable through the API at all — it comes from
  `SUPER_ADMIN_*` (on boot, or `pnpm seed:admin`) only, so a compromised admin
  can't escalate past the account that can revoke it.
- A bKash Transaction ID can pay for one order only, and an order only becomes
  `PAID` when an admin confirms it — nothing a student sends grants access.
- Uploads are capped at 5 MB with a MIME allow-list *and* magic-byte
  verification, because the client-supplied `Content-Type` is trivially spoofed.
- The CSP is maximally locked down (`default-src 'none'`): this server returns
  JSON only, so nothing in a response should ever load or execute.
- Rate limiters are in-process unless `REDIS_URL` is set. Set it before running
  more than one instance, or the limits become per-process rather than per-user.

---

## Deployment

The API runs on **Render** (`../render.yaml`, a Blueprint) and the web app on
**Vercel** (`../client/vercel.json`). They must share a parent domain —
`half-coders.tech` for the web app, `api.half-coders.tech` for the API — so the
session cookie is first-party to both: the browser sends it to the API, and the
web app's own server can read it. A `*.vercel.app` web app talking to a
`*.onrender.com` API is cross-site, and browsers won't send a `SameSite=Lax`
cookie there at all — sign-in would seem to work and then forget you.

Proxying the API through Vercel instead doesn't work here: Socket.IO is
WebSocket-only (`lib/realtime.ts`), and Vercel rewrites don't carry WebSockets.

**First launch, in order:**

1. **Database.** The Neon database, with `DATABASE_URL` ending in
   `?schema=learning`. The Blueprint puts the API in Render's Ohio region, next
   to Neon's `us-east-2`.
2. **Render.** Dashboard → New → Blueprint → this repository. Fill in the
   variables it asks for (database, SMTP, Cloudinary, `SUPER_ADMIN_EMAIL` /
   `_PASSWORD`); `AUTH_SECRET` is generated. The plan is **Starter**: free web
   services block outbound SMTP, so no verification email would leave, and
   they sleep after 15 idle minutes. Each start runs `pnpm migrate:prod`
   (a no-op when nothing is pending), then the server, which seeds the super
   admin, categories and courses itself. `/readiness` is the health check.
3. **API domain.** On the service: Settings → Custom Domains → add
   `api.half-coders.tech`, and the CNAME Render shows at your DNS provider.
4. **Vercel.** Import the repository with **Root Directory `client`**, set the
   variables from `client/.env.production.example`, deploy, and add
   `half-coders.tech` (Settings → Domains). `FRONTEND_URL` on Render must be
   exactly that origin — it's the CORS allow-list for REST and sockets alike.
5. **Check the IPs.** Sign in, open "My devices" and compare the IP shown with
   your own. A proxy's address means `TRUST_PROXY` should go up by one.

With `REDIS_URL` set, several API instances can run side by side: rate-limit
counters live in Redis, Socket.IO pushes cross between instances through its
Redis adapter, and the release scheduler takes a PostgreSQL advisory lock per
tick so only one instance runs the jobs. Without it, run a single instance.

`Dockerfile.prod` still builds a self-contained image (non-root, `/readiness`
as its healthcheck) for a VPS behind nginx; there the same-domain rule is met
by proxying `/api/` and `/socket.io/` to port 5001 instead.

---

## Status

**Phase 1 — Core MVP: done, verified end to end.** Accounts (sign-up, email
verification, sign-in, password reset), course catalogue and details, curriculum management, checkout and
enrolment, the gated learning page, the progress cascade, XP and leaderboard,
notifications, and all three dashboards.

**Phase 2 — Learning system: done, verified end to end.** Assignments with the
full submit → review → revise → accept loop, score-proportional XP, practice
days, course schedules, notifications, and certificates with public
verification at `/api/v1/certificates/verify/:certificateNo`.

Two rules worth knowing about certificates:

- Eligibility is evaluated **live**, never stored, so publishing new content
  into a finished course immediately withdraws it rather than leaving a stale
  flag behind.
- A published milestone with no published modules does **not** count toward
  eligibility. That is unfinished authoring, not unfinished learning —
  counting it would block the whole cohort behind content that doesn't exist.

**Phase 3 — Support system: done, verified end to end.** Scheduled sessions
with time-based availability, the manual serial queue, the mentor's queue board
(serve-next / complete / skip), attendance history, and live Socket.IO updates
to every watching student.

**Payments: manual bKash.** Students pay the merchant account themselves
(scan its QR, or "Payment" to the number in the bKash app), then send the
transaction ID and the number they paid from (`POST /orders/:id/bkash`,
`POST /bundles/orders/:id/bkash` — `utils/bkash.ts`). The order stays PENDING
with the details on its payment until an admin matches them against the
merchant statement and marks it paid (`OrderService.markOrderPaid`) or turns
it down (`markOrderFailed` — the student is emailed why). A transaction ID can
pay for one order only.

**Quizzes & assessments: done.** One quiz per `CourseModule` (`Quiz` →
`QuizQuestion` → `QuizOption`, single-choice only for now but the
`QuizQuestionType` enum leaves room to add more without a destructive
migration), with independent, fully-preserved `QuizAttempt` rows per attempt
(retries never overwrite each other) and per-question `QuizAttemptAnswer`
rows. Correctness is computed and stored server-side only — the student-facing
endpoints never send `isCorrect` for a question that hasn't been answered yet.
XP awards through the existing `awardXp` ledger (`XpSource.QUIZ_COMPLETE`,
idempotent per student per quiz, so retries don't farm points). Deliberately
**not** wired into `ModuleProgress`/`MilestoneProgress`'s percentage — same as
`Assignment` and `PracticeDay`, it shows as its own completion badge in the
learning sidebar rather than feeding the video-based progress math.

**Course type: done.** `Course.courseType` (`BOOTCAMP` | `TRADITIONAL`,
default `BOOTCAMP` — the platform's original, single-mode behaviour) decides
whether `/learn/[slug]/outline`'s real-time, date-scheduled table is reachable
for a course; a traditional course uses only the plain milestone/module
syllabus. Quizzes, assignments, practice days and support sessions are
unaffected by this flag — they work identically for both types.

Still open, in planned order: **reviews & ratings** (never modelled;
`Testimonial` is admin-curated marketing copy, not student reviews) and
**advanced analytics**. Gamification and the XP system shipped with Phase 1.
