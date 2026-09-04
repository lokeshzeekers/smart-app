import { NavLink } from 'react-router-dom';

// Home — stethoscope
const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M6 3v6a4 4 0 008 0V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 13v2a5 5 0 005 5 5 5 0 005-5v-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="20" cy="12.5" r="1.6" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);

// Coach — clipboard with checklist (step-by-step guidance)
const CoachIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M9 3.5h6a1 1 0 011 1V6H8V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M8.5 11.5l1.5 1.5 2.5-2.8M8.5 16.5l1.5 1.5 2.5-2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Check — vitals pulse (graded attempt metrics)
const CheckModeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M3 12.5h4l1.5-4 2.5 8 2-5.5 1.5 2.5H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Certification — award / medal (formal certification record)
const CertificationIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M9 13.5L7.5 20l4.5-2 4.5 2-1.5-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const items = [
  { to: '/trainee/home', icon: HomeIcon },
  { to: '/trainee/coach', icon: CoachIcon },
  { to: '/trainee/check', icon: CheckModeIcon },
  { to: '/trainee/certification', icon: CertificationIcon },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-border px-8 py-3 flex justify-between items-center max-w-md mx-auto">
      {items.map(({ to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => (isActive ? 'text-brand-700' : 'text-ink-300')}
        >
          <Icon />
        </NavLink>
      ))}
    </nav>
  );
}
