import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-ink-950 text-ink-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="rounded-lg bg-white/5 p-3 inline-block">
            <Logo className="text-white" />
          </div>
          <p className="mt-4 max-w-md text-sm text-ink-300">
            Locally owned and fully insured. From small fixes to full remodels,
            we make sure it gets done right the first time.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Contact
          </h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a
                href="tel:+15555551234"
                className="hover:text-white"
              >
                (555) 555-1234
              </a>
            </li>
            <li>
              <a
                href="mailto:hello@onestophandymanllc.com"
                className="hover:text-white"
              >
                hello@onestophandymanllc.com
              </a>
            </li>
            <li className="text-ink-300">Serving the local area</li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Hours
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-ink-300">
            <li>Mon – Fri · 7:00 AM – 7:00 PM</li>
            <li>Saturday · 8:00 AM – 4:00 PM</li>
            <li>Sunday · Emergency only</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-ink-400 sm:flex-row">
          <p>
            © {new Date().getFullYear()} One Stop Handy Man LLC. All rights
            reserved.
          </p>
          <p>Licensed · Insured · Bonded</p>
        </div>
      </div>
    </footer>
  );
}
