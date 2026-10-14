import { useState } from 'react';
import { BadgePercent, CalendarClock, ShieldCheck } from 'lucide-react';
import { useBookingFlow } from '../context/BookingFlowContext';
import { SearchForm } from '../components/SearchForm';

const DESTINATIONS = [
  { code: 'LHR', city: 'London', country: 'United Kingdom', tone: 'from-sky-500 via-brand-600 to-indigo-700' },
  { code: 'CDG', city: 'Paris', country: 'France', tone: 'from-rose-400 via-accent-500 to-indigo-600' },
  { code: 'FCO', city: 'Rome', country: 'Italy', tone: 'from-amber-400 via-orange-500 to-rose-600' },
  { code: 'BCN', city: 'Barcelona', country: 'Spain', tone: 'from-cyan-400 via-sky-500 to-brand-700' },
  { code: 'DXB', city: 'Dubai', country: 'United Arab Emirates', tone: 'from-yellow-400 via-amber-500 to-orange-700' },
  { code: 'JFK', city: 'New York', country: 'United States', tone: 'from-slate-500 via-brand-700 to-accent-800' },
];

function HeroArt() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="hero-glow" cx="80%" cy="10%" r="60%">
          <stop offset="0" stopColor="#a78bfa" stopOpacity=".55" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="420" fill="url(#hero-glow)" />
      <path d="M-20 330 C 260 200, 520 380, 760 210 S 1100 90, 1240 140" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="2" strokeDasharray="6 10" />
      <path d="M-20 380 C 300 300, 600 420, 900 300 S 1150 250, 1240 260" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="2" />
      <g transform="translate(960 118) rotate(-18)" fill="#fff" fillOpacity=".9">
        <path d="M0 0 L46 -6 L58 -22 L66 -20 L60 -4 L84 0 L60 4 L66 20 L58 22 L46 6 Z" />
      </g>
      <circle cx="150" cy="90" r="2" fill="#fff" fillOpacity=".6" />
      <circle cx="420" cy="60" r="1.5" fill="#fff" fillOpacity=".5" />
      <circle cx="700" cy="110" r="2" fill="#fff" fillOpacity=".4" />
      <circle cx="1080" cy="300" r="1.5" fill="#fff" fillOpacity=".5" />
    </svg>
  );
}

export function HomePage() {
  const flow = useBookingFlow();
  const [preset, setPreset] = useState<{ code: string; nonce: number } | null>(null);

  const subtitle = 'Great fares, flexible cancellation and no hidden fees on every route.';

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-accent-700 pb-40 pt-14 text-white sm:pt-20">
        <HeroArt />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ring-inset ring-white/25">
            SkyRoute flights
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">Find your next destination</h1>
          <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">{subtitle}</p>
        </div>
      </section>

      <div className="relative mx-auto -mt-32 max-w-7xl px-4 sm:px-6">
        <SearchForm initial={flow.criteria} presetDestination={preset} />
      </div>

      <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6" aria-labelledby="popular-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="popular-heading" className="text-2xl font-bold">
              Popular destinations
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Daily departures from Tel Aviv. Pick a city to start your search.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
          {DESTINATIONS.map((d) => (
            <button
              key={d.code}
              type="button"
              onClick={() => {
                setPreset({ code: d.code, nonce: Date.now() });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`group relative h-36 overflow-hidden rounded-2xl bg-gradient-to-br ${d.tone} p-4 text-left text-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2`}
            >
              <span className="absolute -right-3 top-1 font-display text-6xl font-extrabold text-white/15 transition group-hover:text-white/25">{d.code}</span>
              <span className="absolute bottom-4 left-4">
                <span className="block text-lg font-bold">{d.city}</span>
                <span className="block text-xs text-white/80">{d.country}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3">
        {[
          { icon: BadgePercent, title: 'Transparent pricing', text: 'See base fare, taxes and fees before you confirm. Children and infants fly at reduced fares.' },
          { icon: CalendarClock, title: 'Flexible cancellation', text: 'Cancel online up to 24 hours before departure from the My Bookings page.' },
          { icon: ShieldCheck, title: 'Instant confirmation', text: 'Get your booking reference immediately and manage your trip any time.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-accent-50 text-brand-600">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
