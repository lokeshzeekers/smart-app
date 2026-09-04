import { NavLink } from 'react-router-dom';

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8"/><path d="M20 20l-3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
);
const HistoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 8a9 9 0 1 1 1.2 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
);
const WalletIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3 10h18" stroke="currentColor" strokeWidth="1.8"/><circle cx="16.5" cy="14" r="1.2" fill="currentColor"/></svg>
);

const items = [
  { to: '/trainee/home', icon: HomeIcon },
  { to: '/trainee/coach', icon: SearchIcon },
  { to: '/trainee/certification', icon: HistoryIcon },
  { to: '/trainee/wallet', icon: WalletIcon },
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
