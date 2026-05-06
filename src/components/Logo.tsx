export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`}>
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white shadow-cta"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-base font-extrabold tracking-tight text-ink-900">
          One Stop Handy Man
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700">
          LLC
        </span>
      </span>
    </span>
  );
}
