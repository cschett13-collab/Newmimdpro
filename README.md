# One Stop Handy Man LLC — Website

Marketing site for **One Stop Handy Man LLC**, a locally owned handyman
business. Single-page Next.js + Tailwind site covering services, about,
process, reviews, and a contact form.

## Tech

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS for styling
- No backend — the contact form `mailto:`-submits to the business inbox

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Build & deploy

```bash
npm run build
npm run start
```

Any Node host works. For Vercel, just connect the repo and deploy — no env
vars required.

## What to customize

- **Phone & email**: search for `(555) 555-1234` and
  `hello@onestophandymanllc.com` and replace.
- **Service area copy**: see the contact section in `src/app/page.tsx`.
- **Services / pricing / reviews**: top of `src/app/page.tsx`
  (`SERVICES`, `REASONS`, `REVIEWS` arrays + the hero "availability" card).
- **Brand color**: `tailwind.config.ts`, the `brand` palette.

## File map

```
src/
  app/
    layout.tsx     site metadata + html shell
    page.tsx       all sections (hero, services, about, process, reviews, contact)
    globals.css    Tailwind + small component classes
  components/
    Header.tsx
    Footer.tsx
    Logo.tsx
    icons.tsx      inline SVG icon set
```
