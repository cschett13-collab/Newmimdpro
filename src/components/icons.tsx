type IconProps = { className?: string };

const baseSvg = "stroke-current";

export const WrenchIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
  </svg>
);

export const PaintRollerIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <rect x="3" y="3" width="14" height="6" rx="1.5" />
    <path d="M21 6h-4" />
    <path d="M19 9v3a2 2 0 0 1-2 2H7v3" />
    <rect x="5" y="17" width="4" height="4" rx="1" />
  </svg>
);

export const FaucetIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M9 6V4a3 3 0 0 1 6 0" />
    <path d="M3 11h18" />
    <path d="M5 11v3a2 2 0 0 0 2 2h2" />
    <path d="M9 16h2v3a3 3 0 0 1-3 3H6" />
    <path d="M14 14a4 4 0 0 1 4-4" />
  </svg>
);

export const PlugIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M9 2v4M15 2v4" />
    <path d="M7 6h10v6a5 5 0 0 1-10 0V6z" />
    <path d="M12 17v5" />
  </svg>
);

export const HammerIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M14 4l6 3-3 6-3-3-9 9-3-3 9-9-3-3z" />
  </svg>
);

export const HouseIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v9h14v-9" />
    <path d="M10 19v-5h4v5" />
  </svg>
);

export const DeckIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M3 7h18M3 12h18M3 17h18" />
    <path d="M6 7v13M12 7v13M18 7v13" />
  </svg>
);

export const TilesIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="8" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" />
    <rect x="13" y="13" width="8" height="8" rx="1" />
  </svg>
);

export const CheckIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M5 12l5 5 9-11" />
  </svg>
);

export const ShieldIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const ClockIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const StarIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={`${className}`}>
    <path d="M12 2.5l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 18.25 5.82 21.5 7 14.63 2 9.76l6.91-1L12 2.5z" />
  </svg>
);

export const PhoneIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M5 4h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

export const MailIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const PinIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${baseSvg} ${className}`}>
    <path d="M12 22s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
