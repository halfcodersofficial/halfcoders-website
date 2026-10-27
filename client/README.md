# Half Coders — Frontend

The web app for **half-coders.tech**. Next.js 15 (App Router) +
TypeScript + Tailwind v4, talking to the Half Coders API over a session cookie.

Runs on port **3001**; the API (`../server`) runs on **5001**.

---

## Getting started

```bash
pnpm install
cp .env.example .env.local     # point NEXT_PUBLIC_API_BASE_URL at the API
pnpm dev                       # http://localhost:3001
```

The API must be running (see `../server`). Without it the marketing copy still
renders, but the catalogue, dashboard and learning pages will show their empty
or error states.

| Script | Does |
| --- | --- |
| `pnpm dev` | Dev server on :3001 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the build on :3001 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

### Deploying (Vercel)

Import the repository into Vercel with **Root Directory `client`** —
`vercel.json` there pins the framework, pnpm and the `cle1` (Ohio) region,
beside the API on Render and its Neon database. Set the variables from
`.env.production.example` for Production, then add the domain
(`half-coders.tech`).

The API must be on a subdomain of the same domain (`api.half-coders.tech`),
with `COOKIE_DOMAIN=half-coders.tech` on its side: the session cookie is then
first-party to both. A `*.vercel.app` preview can't sign anyone in against it —
the cookie isn't sent cross-site. Full order of setup: `../server/README.md`,
"Deployment".

A build doesn't need the API to be up: the sitemap and course pages fall back
to their static parts and fill in on the next revalidation.

---

## How it talks to the API

`src/lib/httpClient.ts` is the only place that knows about transport. Two
things matter:

- **`withCredentials: true`.** The API authenticates with its own httpOnly
  session cookie (`halfcoders.session_token`, set on sign-in). There is no
  token in JS to store — or for an XSS payload to steal.
- **A 401 redirects to `/login?next=…`**, except on requests marked `_silent`.
  Background polls (the notification badge, the support-queue fallback) set that
  flag so a transient 401 never yanks the page out from under someone.

Error copy comes from the API. The backend already writes messages meant for end
users — *"The deadline for this assignment has passed"* — so `getApiErrorMessage`
surfaces `message` verbatim rather than inventing local wording.

`src/services/index.ts` wraps every endpoint and unwraps the
`{ success, message, data, meta }` envelope, so components never see it.

---

## Rendering strategy

Server-rendered where it helps SEO, client-rendered where freshness matters:

| Page | Strategy | Why |
| --- | --- | --- |
| `/courses/[slug]` | SSR + ISR | The main crawlable surface for each course |
| `/certificate/[certificateNo]` | SSR, `no-store` | A verifier must see current status, never a cached one |
| `/mentors` | ISR | Changes rarely |
| `/` shell | Static | Marketing copy, no data dependency |
| `/` catalogue | Client (React Query) | See below |
| `/courses`, `/dashboard`, `/learn/*` | Client | Personalised or filter-driven |

**Why the homepage catalogue is client-rendered.** It was originally server-fetched
with ISR, and the fetch helper swallowed errors and returned `null` so the page
would still render. The result was worse than a visible failure: one blip during
a deploy cached an *empty* homepage, and the site advertised zero courses for the
whole revalidate window. React Query retries, shows a skeleton, and never
persists a failure. The SEO copy around it still renders on the server, and
`/courses` plus each course page remain crawlable.

---

## The paywall

Course videos are unlisted YouTube uploads — the links *are* the product.

- `/courses/[slug]` shows lesson titles and durations but **never** a video URL.
  The API omits them from the public payload; the page has nothing to leak.
- `/learn/[slug]` is where URLs arrive, and only after the API confirms an
  enrolment. Under sequential learning a locked module's videos come back with
  `youtubeUrl: null`, so a locked lesson is genuinely unreachable rather than
  just visually disabled.
- Videos embed through `youtube-nocookie.com`.

---

## The support queue

`/learn/[slug]/support` mirrors how the queue actually works: **the mentor
advances the serial by hand.** They finish with a student, click Done, and the
next number becomes current.

- `useSupportSocket` subscribes to that session's room and re-renders on every
  push — join, advance, session close.
- A REST poll runs alongside as a fallback, slow (60s) while the socket is
  connected and faster (10s) when it isn't, so a failed handshake degrades
  instead of breaking.
- The wait time is labelled an estimate, because it is: `peopleAhead ×
  slotMinutes`. A long question pushes everyone back. The copy says so rather
  than implying a countdown.
- The Google Meet link only appears once the session is live.

---

## Structure

```
src/
├── app/
│   ├── (public)/     marketing, catalogue, dashboard, checkout, certificates
│   ├── (auth)/       login, register, verify-email, forgot-password,
│   │                 reset-password, change-password
│   ├── learn/[slug]/ the course player, assignments, practice, support
│   ├── mentor/       role-gated console: dashboard, reviews, queue board
│   └── admin/        role-gated console: nine management screens
├── components/
│   ├── ui/           button, card, badge, input, progress, avatar, skeleton,
│   │                 accordion
│   ├── shared/       Navbar, Footer, CourseCard, EnrollButton, HomeCatalogue,
│   │                 Breadcrumbs, CategoryIcon, CourseSectionNav,
│   │                 CourseStickyBar, CurriculumAccordion
│   └── admin/        DataShell — the shared list-screen chrome
├── hooks/            useSession, useSupportSocket
├── lib/              httpClient, envConfig, utils
├── services/         one wrapper per API area
└── types/            api + domain types mirroring the Prisma models
```

---

## Design system

Half Coders is dressed as a **friendly code editor**: editor windows with tabs,
a graph-paper grid, a dark editor surface, syntax colours and a violet status
bar. The look is decoration only — every label, heading and button is plain
Bangla or English a beginner understands (no file names, shell commands or
JSON keys as text). It must also stay clearly different from eSkill, the
product Half Coders was forked from.

Tokens live in `app/globals.css`:

- **Fonts** (self-hosted, `app/layout.tsx`): Space Grotesk for headings, Geist
  for reading, JetBrains Mono for the "code" touches; Baloo Da 2 and Hind
  Siliguri for Bangla.
- **Colours**: the logo's violet/lilac, plus `syn-*` syntax colours
  (`text-syn-string`, `bg-syn-keyword/10`…). Inside `.editor` (the fixed dark
  surface) the syntax colours switch to their dark-surface shades on their own.
- **Shape and depth**: corners are barely rounded (`rounded-card`, 8px);
  hairline borders do the separating, and a hover is a violet border with a
  thin halo — nothing lifts or tilts.

The building blocks:

| Piece | Job |
| --- | --- |
| `components/site/EditorWindow` | A window with editor tabs (`{ name, label }` — the name picks the icon, the label is what it says) and an optional status bar |
| `components/site/code.tsx` | `Eyebrow` (the `// label` above section titles), syntax-coloured spans, `Prompt` |
| `components/site/Section` / `SectionHeader` / `PageHeader` | Page bands (`tone="dark"` is the editor surface on graph paper) and their headings |
| `components/site/CtaButton` | Start Learning / Browse Courses / View All Courses (`.cmd`: mono label, halo on hover) |
| `components/ui/skeleton` | `Skeleton` and `SkeletonLines` — a band scanning across (`.skeleton-scan`) |

`.section` / `.section-sm` carry the vertical rhythm between bands.

---

## Forms and validation

Every form on the platform — auth, profile, course authoring, broadcast,
settings, submissions — runs through one small stack. There is no
react-hook-form: the API's Zod schemas already exist, so the client mirrors
them rather than adding a second dependency and a resolver.

| Piece | Job |
| --- | --- |
| `lib/validation.ts` | Field rules mirroring `server/**/**.validation.ts`, plus `passwordStrength()` |
| `hooks/useZodForm.ts` | Values, live per-field errors, submit, focus-first-error |
| `components/ui/form.tsx` | `FormField` — label, required marker, hint, counter, error |
| `components/ui/input.tsx` | `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup` |
| `components/ui/password-input.tsx` | Reveal toggle, strength meter, live rule checklist |
| `components/ui/otp-input.tsx` | Six-box verification code entry |
| `components/ui/date-time.tsx` | `DateInput` / `TimeInput` / `DateTimeInput` + local↔ISO helpers |

Five decisions are worth knowing:

- **Errors sit under the field they belong to, and say what is actually
  wrong.** *"Password must include an uppercase letter"*, not *"Invalid
  input"*. A cross-field rule with no single field to blame (`.refine()` with
  no `path`) renders as a `FormError` above the submit button instead.
- **A field arms itself on first contact.** Nothing is red on a pristine form;
  from the first keystroke — or a blur, which catches a field tabbed straight
  past — that field validates on every change. Submitting arms everything and
  moves focus to the first problem, which on a long form is otherwise
  off-screen.
- **Native constraint attributes are deliberately absent.** No `required`,
  `pattern` or `minLength` on the elements, and `noValidate` on the `<form>`.
  The browser's own validation bubble would fire on submit and compete with the
  message under the field — two answers to one question, only one of them
  specific.
- **`FormField` wires the control through context.** Any prop passed explicitly
  still wins, which is how the few fields that need custom behaviour (upper-
  casing a certificate prefix, masking a code) opt out without leaving the
  pattern.
- **Dates, times and selects are native controls, restyled.** `<select>`,
  `<input type="date">` and friends get the platform's own picker on a phone,
  arrow-key and type-ahead navigation on desktop, and correct screen-reader
  announcements — none of which a div-based replacement gets for free. The
  wrappers add a full-height trigger (Firefox renders no indicator of its own)
  and the local-wall-clock ↔ ISO conversion the API needs.

Controls are 44px tall and 16px-text on mobile, 40px and 14px from `sm` up:
below 44px a thumb misses, and below 16px iOS Safari zooms the page on focus.

The sign-in and sign-up screens use a different field, `AuthField`: the
label above the box, an icon inside it, and a tick or a warning mark at the
right once the value passes or fails its rule. It bypasses `FormField`
for the layout only — the input still carries `form.idFor(name)`, so a failed
submit focuses the first problem, and the error sits under the box as
everywhere else. The `(auth)` layout is a split shell: a terminal panel on
the dark editor surface on the left (wide screens only), the form on the
right, and `AuthModeToggle` — two editor tabs — switching between `/login`
and `/register` as two real URLs (carrying `?next=` across) rather than two
tabs on one page. `(auth)/template.tsx` remounts the form and slides it in
from the side the reader is moving toward, honouring
`prefers-reduced-motion`. There is no
social sign-in row because the API has no OAuth provider configured; adding
buttons that go nowhere would be worse than none.

## Accounts

Half Coders has its own accounts — email and password — and nothing is shared
with any other site. The screens live in `app/(auth)/`, their forms in
`components/auth/`, and the calls in `authService` (`services/index.ts`):

- **Sign up** asks for name, email, phone number and password. Throwaway inboxes
  are refused before the request goes out (`lib/disposableEmail.ts`, the same
  list the API checks); edu and business addresses are fine. The phone number
  is for the team to reach a learner — Half Coders sends no text messages.
- **Verify email** takes the six-digit code the API mails (15 minutes, a new
  one at most once a minute). Signing in to an unverified account mails a fresh
  code and lands here.
- **Forgot / reset password** works the same way: a code by email, then a new
  password. Every other session of that account is signed out.
- **Change password** is also where `RoleGuard` sends anyone whose account was
  created for them (a mentor or admin) until they pick their own password.
- **Sign out** asks the API to end the session, then reloads to `/`, so no
  cached page of the signed-in site survives.

`useSession` reads `GET /auth/me`; the `(auth)` pages wrap themselves in
`GuestOnly` so a signed-in visitor goes straight on to `?next=` (checked by
`safeNext`, so it can only point inside the site).

## The course page

`/courses/[slug]` is the page that has to sell the course, so it carries more
structure than the rest of the site:

- **`CourseSectionNav`** sticks below the header and highlights the section in
  view. It uses `IntersectionObserver` with a `rootMargin` that pulls the
  detection band under the sticky header and stops it short of the viewport
  bottom — otherwise a short final section can never become active, because it
  never reaches the top of the screen.
- **`CurriculumAccordion`** is controlled React state, not `<details>`. The
  expand-all control has to drive every row at once, and a native `details` can
  only be opened by mutating the DOM node, which React then fights.
- **`CourseStickyBar`** is the mobile purchase bar, revealed once the reader
  has scrolled past the hero. On a phone the price card is thousands of pixels
  behind them by the time they've read the curriculum. It's `inert` while
  hidden so it never catches a tab.
- **Structured data.** The page emits `Course` JSON-LD (with a
  `CourseInstance` when a batch date is set) and `FAQPage` JSON-LD, and
  `Breadcrumbs` emits `BreadcrumbList` — which is what turns a bare URL in
  search results into a card with the provider, price and trail attached.

The layout: a dark editor-surface header with the breadcrumb, the course's
tags, title, facts, a countdown while enrolment is open, and the promo media
(`CoursePromoCard` — the embed only mounts on click); under it a workspace of
an outline panel (`CourseOutline`, wide screens), the sections, and a sticky
enrol panel; then a terminal-style closing panel (`CourseClosing`). The
sections: mentors, features, tools, outcomes, reviews, overview, how the
course runs, requirements, batch dates, how to enrol (bKash) and FAQ.

Three of those sections are driven by content an admin or mentor writes:

- **Feature tiles** are `{ icon, title, description }` rows. The icon is a key
  into `lib/courseFeatureIcons.ts`, mirrored by a closed enum on the API, so
  the editor offers a dropdown, the preview draws the same glyph the public
  page will, and nothing user-typed ever reaches an `<img src>`.
- **FAQ** is per course, with `lib/courseFaq.ts` appending the platform-wide
  questions the course hasn't answered itself. The admin preview and the
  public page resolve the list through the same function so they can't drift.
- **Free-preview lessons** (`CurriculumAccordion` → `FreePreviewPlayer`) play
  in a modal without an enrolment. The API releases the video id for those
  lessons only; every other lesson still arrives without one.

---

## Payments

bKash only, checked by hand — there is no payment gateway. The merchant number
and QR code are in `lib/brand.ts` (`BKASH`; the QR image is
`public/payments/bkash-qr.jpeg`).

`/checkout/[orderId]` and `/checkout/bundle/[bundleOrderId]` walk the student
through it with `BkashPayment`: the exact amount, then step by step how to pay
either by scanning the QR in the bKash app or with "Payment" to the merchant
number, then a form for the Transaction ID and the number they paid from
(`POST /orders/:id/bkash`). `CheckoutSteps` shows where they are — Cart →
Payment → Verify → Access. Once sent, the order stays `PENDING` and the page
polls, so it flips to the enrolled state on its own when an admin confirms the
payment in `/admin/orders`. If the admin turns it down, the order is marked
failed and the student is emailed the reason; they check out again for a new
order.

## The mentor console

`/mentor` is gated on role in the layout — admins are let through too, since
they manage every course anyway. That gate is navigation, not security: the API
enforces the real boundary on every request, and a mentor only ever sees the
courses they're assigned to.

- **`/mentor/support/[sessionId]`** is the queue board. One primary button —
  *Done — call next* — completes the current student and promotes the next
  serial, which is the whole loop. *Complete without calling next* and *Skip*
  are the exceptions. The board prefers socket state over the REST snapshot so
  the numbers never lag.
- **`/mentor/reviews`** is the review queue, oldest first. The verdict is a
  field, not three submit buttons: picking *Accept* makes the score required,
  picking either return action makes the feedback required, and both say so
  before the mentor commits. Three buttons could only be disabled with the
  reason hidden in a `title`.
- **`/mentor/courses/[courseId]`** is the mentor's course page: enrolment and
  publish counts, a "is the page ready to sell?" checklist, and an editor for
  the words on the public page — subtitle, description, media, feature tiles,
  outcomes, FAQ — beside the same live preview the admin editor shows. Price,
  category, level and the publish state are shown as facts, not fields: the
  API refuses them from a mentor account (`PATCH /courses/staff/:id/content`
  is a fixed allow-list of content fields), so offering the inputs would only
  produce a form that silently ignores them.
- **`/mentor/courses/[courseId]/curriculum`** shows the curriculum with each
  item's published state, which is how a mentor spots the module they forgot
  to publish, and builds it out inline.

The content fields themselves — schema fragment, value shape, field markup —
live once in `components/staff/CoursePageContentFields.tsx` and both consoles
compose their form around it, so a rule can't be tightened in one editor and
left loose in the other.

## The admin console

`/admin` is gated on role in the layout, like the mentor console — navigation
only, since the API enforces the real boundary and several actions
(creating admins, changing roles) are super-admin-only server-side.

Every register — courses, students, mentors, payments, enrolments,
certificates, and the smaller ones — is built from the same four parts, so an
admin who has learned one screen has learned them all:

| Piece | Job |
| --- | --- |
| `components/admin/DataShell` | Heading and one primary button, a live (debounced) search box, a segmented status filter, loading / empty / paging |
| `components/admin/DataTable` | A real table from `md` up; the same columns as labelled cards on a phone |
| `components/admin/RowActions` | One visible button per row, everything else behind a "⋯" menu, destructive items last and red |
| `components/ui/sheet` | A right-hand drawer for every create, edit and reason-required flow — the list never moves |

Two rules follow from that. Nothing expands inline: creating a course, editing
a mentor, confirming a payment or revoking a certificate opens a drawer with
one job and one primary button, and closing it lands back on the list. And
nothing asks for an ID: `EntityPicker` is a type-to-search control, so manual
enrolment and manual certificate issue both start from a student's name.

`StatusPill` maps every enum the API returns to the words an admin reads
("Awaiting payment", not "PENDING") and the colour it carries, in one table.

**`/admin/orders` is the busiest screen.** Every bKash payment is confirmed
here by hand — it is the only route from a payment to an enrolment — so it opens
on the *Awaiting payment* filter, the dashboard surfaces pending orders above
everything else, and the order drawer shows the Transaction ID and sender number
the student sent in, to match against the merchant statement, and spells out
that confirming grants access immediately.

**`/admin/courses/[courseId]`** splits the editor by what the admin came to
do — *Basics* (catalogue, pricing, promotion), *Course page* (the words
students read, shared with the mentor editor), *Mentors* and *Schedule* —
with the live student preview alongside. A failed save switches to the tab
holding the first problem and marks it, so an error on a hidden tab can't be
missed. Creating a course asks for four fields and lands here for the rest.

`/admin/settings` edits the tunables the plan calls out — XP values, support
slot length, certificate prefix, sequential learning — each with a reset to the
built-in default. The slot-length field says plainly that it only drives the
wait *estimate* and never cuts a student off, because that is the question
mentors ask about it.

## Curriculum authoring

`/mentor/courses/[courseId]` builds a course out: add milestones, modules,
assignments and practice days inline, with a publish toggle on every item so
nothing reaches students before it's ready. Deleting a milestone or module
confirms first, because it cascades to everything beneath it.

`/mentor/courses/[courseId]/modules/[moduleId]` manages lessons. Videos are
unlisted YouTube uploads, so there is no file upload — you paste a share link.
The **bulk paste** box takes one lesson per line as
`Title | YouTube link | duration`, and reports unparseable lines *by number*
rather than dropping them: silently losing one lesson out of a forty-line paste
would be worse than refusing the batch. Publish-all / hide-all act on the whole
module at once. Each lesson also has a **free preview** toggle — the one place
a video deliberately crosses the paywall, so it is a per-lesson choice and
never a default.

## Course type: Bootcamp vs Traditional

`Course.courseType` (`BOOTCAMP` | `TRADITIONAL`, default `BOOTCAMP`) decides
which outline experience a course gets. A bootcamp course's sidebar links to
`/learn/[slug]/outline`, the real-time, date-scheduled `Date | Module Name |
Publish Date | Status` table; a traditional course has no such link and a
direct visit redirects back to the plain milestone/module syllabus at
`/learn/[slug]`. Admin sets/edits the type on the course editor's Basics tab;
mentors see it as a read-only badge. Every other learning feature — lessons,
quizzes, assignments, practice days, support sessions, certificates — works
identically for both types.

## Quizzes

A module may have one quiz (`/admin` or `/mentor` →
`.../modules/[moduleId]/quiz`, next to that module's Lessons editor) — single-
choice questions, 2-6 options each, exactly one marked correct. Publishing is
blocked with zero questions; nothing else needs an explicit "can this be
published" check because option validity is enforced on every question write,
not just at publish time.

Students reach a published quiz from the course-content sidebar
(`/learn/[slug]`), right after that module's lessons. `QuizPane` drives the
whole attempt: landing (best score, past attempts, start/resume/retake) →
one question at a time with instant per-answer feedback (colour-coded options
plus the explanation, revealed only after that question is answered — never
before) → a result screen → "See Correct Answers" review. Retries are
unlimited and each attempt is its own row, so a worse retake never overwrites
a better one; XP is awarded once per student per quiz no matter how many
attempts are made.

## Not built yet

Two things are open:

1. **Reviews & ratings** — never modelled (plan §8 marks it a future feature).
   `Testimonial` is admin-curated marketing copy, not student course reviews,
   so there is no rating average to show on a card or sort the catalogue by.
2. **Advanced analytics** beyond the counters on the admin dashboard.

Payments (manual bKash) and quizzes were the last two items on this list and
are both done — see "Payments" and "Quizzes" above.
