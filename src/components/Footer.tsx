import { Link } from 'react-router-dom';
import { Instagram, Facebook } from 'lucide-react';
import { socialLinks } from '../data/site';
import { useLanguage } from '../i18n';
import { TikTokIcon } from './TikTokIcon';

export function Footer() {
  const { content } = useLanguage();

  return (
    <footer className="border-t border-red-500/20 bg-black px-4 py-12 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link to="/" className="inline-flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src="/assets/prestige-logo.jpeg"
              alt={content.common.brandAlt}
              className="h-20 w-28 rounded-md border border-red-500/25 object-cover object-center shadow-glow"
            />
            <span className="chrome-text font-display text-3xl">Prestige Auto Detailing</span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-7 text-platinum/65">
            {content.common.footerCopy}
          </p>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-gold">{content.common.quickLinks}</p>
          <div className="mt-4 grid gap-3">
            {content.navLinks.map((link) => (
              <Link key={link.path} to={link.path} className="text-sm text-platinum/70 hover:text-gold">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-gold">{content.common.connect}</p>
          <div className="mt-4 flex gap-4 text-platinum/70">
            <a href={socialLinks.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="transition hover:text-gold">
              <Instagram />
            </a>
            <a href={socialLinks.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="transition hover:text-gold">
              <Facebook />
            </a>
            <a href={socialLinks.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className="transition hover:text-gold">
              <TikTokIcon />
            </a>
          </div>
          <p className="mt-6 text-xs text-platinum/45">© {new Date().getFullYear()} {content.common.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
