import Link from "next/link";
import { Logo } from "./Logo";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#about", label: "About" },
  { href: "#why", label: "Why Us" },
  { href: "#reviews", label: "Reviews" },
  { href: "#contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="One Stop Handy Man LLC home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-600 transition hover:text-ink-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="tel:+15555551234"
            className="hidden text-sm font-semibold text-ink-700 sm:inline"
          >
            (555) 555-1234
          </a>
          <a href="#contact" className="btn-primary !py-2 !px-4">
            Get a Quote
          </a>
        </div>
      </div>
    </header>
  );
}
