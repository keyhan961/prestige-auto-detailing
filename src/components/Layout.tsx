import { Link, NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { languages, useLanguage } from '../i18n';
import { Footer } from './Footer';
import { CookieBanner } from './CookieBanner';
import { FlagIcon } from './FlagIcon';

export function Layout() {
  const [open, setOpen] = useState(false);
  const { language, setLanguage, content } = useLanguage();

  return (
    <div className="min-h-screen bg-obsidian text-platinum">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-red-500/20 bg-black/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8 md:py-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/assets/prestige-logo.jpeg"
              alt={content.common.brandAlt}
              className="h-10 w-14 rounded-md border border-red-500/25 object-cover object-center shadow-glow sm:h-12 sm:w-16 md:h-14 md:w-20"
            />
            <span className="hidden sm:block">
              <span className="chrome-text block text-sm font-extrabold uppercase tracking-[0.28em]">Prestige</span>
              <span className="block text-[10px] uppercase tracking-[0.35em] text-gold">{content.common.autoDetailing}</span>
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {content.navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `text-sm font-semibold uppercase tracking-[0.18em] transition hover:text-gold ${
                    isActive ? 'text-gold' : 'text-platinum/75'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
              {languages.map((item) => (
                <button
                  key={item.code}
                  onClick={() => setLanguage(item.code)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-[0.16em] transition ${
                    language === item.code ? 'bg-gold text-white shadow-glow' : 'text-platinum/60 hover:text-white'
                  }`}
                >
                  <FlagIcon language={item.code} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <button className="text-white md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
            {open ? <X /> : <Menu />}
          </button>
        </nav>
        {open && (
          <div className="border-t border-white/10 bg-obsidian px-4 py-5 md:hidden">
            {content.navLinks.map((link) => (
              <NavLink key={link.path} to={link.path} onClick={() => setOpen(false)} className="block py-3 text-sm uppercase tracking-[0.2em]">
                {link.label}
              </NavLink>
            ))}
            <div className="mt-4 flex rounded-full border border-white/10 bg-white/5 p-1">
              {languages.map((item) => (
                <button
                  key={item.code}
                  onClick={() => setLanguage(item.code)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold tracking-[0.16em] transition ${
                    language === item.code ? 'bg-gold text-white shadow-glow' : 'text-platinum/60'
                  }`}
                >
                  <FlagIcon language={item.code} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <Link
        to="/contact#booking"
        className="fixed bottom-4 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-red-400/40 bg-gold px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-glow transition hover:bg-red-600 sm:bottom-5 sm:right-5 sm:px-5 sm:text-sm sm:tracking-[0.16em]"
      >
        <CalendarDays size={18} />
        <span className="hidden sm:inline">{content.common.bookAppointment}</span>
      </Link>
      <CookieBanner />
      <Footer />
    </div>
  );
}
