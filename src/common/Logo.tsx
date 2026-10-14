import { cx } from './ui';

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sr-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#254eeb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#sr-logo-g)" />
      <path d="M9 27c6-1 11-5 14-11" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" strokeDasharray="2.5 3" />
      <path d="M31.5 9.2 13.8 16.6c-.8.3-.8 1.4 0 1.7l5 1.9 1.9 5c.3.8 1.4.8 1.7 0l7.4-17.7c.3-.7-.4-1.4-1.1-1.1Z" fill="#fff" />
      <path d="m18.8 20.2 4.7-4.7" stroke="#7c3aed" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="font-display text-xl font-bold tracking-tight text-ink">
          Sky<span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">Route</span>
        </span>
        {subtitle && <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-ink-muted">{subtitle}</span>}
      </span>
    </span>
  );
}
