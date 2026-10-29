// Site footer: logo, contact details, socials and the main links, centered on a tinted band.
import React from 'react';
import { Link } from '../router';
import { useStore } from '../store';
import { FacebookIcon, InstagramIcon, NeedleIcon, TikTokIcon } from './Icons';

export const Footer: React.FC = () => {
  const config = useStore(s => s.config)!;
  const s = config.settings;
  const pages = config.pages.filter(p => p.showInFooter);
  const socials = [
    s.instagramUrl && { href: s.instagramUrl, label: 'Instagram', Icon: InstagramIcon },
    s.tiktokUrl && { href: s.tiktokUrl, label: 'TikTok', Icon: TikTokIcon },
    s.facebookUrl && { href: s.facebookUrl, label: 'Facebook', Icon: FacebookIcon },
  ].filter(Boolean) as { href: string; label: string; Icon: React.FC<{ className?: string }> }[];
  const links = [
    s.features.clientBooking && { to: '/artists', label: 'Find an artist' },
    s.features.boothRental && { to: '/shops', label: 'Guest spots' },
    ...pages.map(p => ({ to: `/p/${p.slug}`, label: p.title })),
    { to: '/contact', label: 'Contact us' },
  ].filter(Boolean) as { to: string; label: string }[];

  return (
    <footer className="mt-24 pb-[env(safe-area-inset-bottom)] bg-brand-tint dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 pt-14 pb-8 text-center">
        <div className="flex items-center justify-center gap-4">
          <span className="hidden sm:block h-px w-16 bg-gray-300 dark:bg-gray-700" />
          <Link to="/" className="inline-flex items-center gap-2" aria-label={`${s.siteName} home`}>
            {s.logoUrl ? (
              <img src={s.logoUrl} alt={s.siteName} className="h-9 w-auto" />
            ) : (
              <>
                <NeedleIcon className="w-7 h-7 text-brand-primary" />
                <span className="font-display font-bold text-2xl">{s.siteName}</span>
              </>
            )}
          </Link>
          <span className="hidden sm:block h-px w-16 bg-gray-300 dark:bg-gray-700" />
        </div>
        {s.tagline && <p className="mt-3 text-brand-gray">{s.tagline}</p>}
        {s.contactEmail && (
          <p className="mt-4">
            <a href={`mailto:${s.contactEmail}`} className="font-medium hover:text-brand-primary">{s.contactEmail}</a>
          </p>
        )}
        {socials.length > 0 && (
          <div className="flex justify-center gap-2 mt-5">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-primary hover:border-brand-primary transition-colors"
              >
                <Icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        )}
        <nav aria-label="Footer" className="mt-8">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
            {links.map(l => (
              <li key={l.to}><Link to={l.to} className="hover:text-brand-primary">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-dashed border-gray-300 dark:border-gray-700">
        <div className="container mx-auto px-4 py-5 text-sm text-brand-gray flex flex-col sm:flex-row justify-center gap-x-3 gap-y-1 text-center">
          <span>{s.footerText || `© ${new Date().getFullYear()} ${s.siteName}. All rights reserved.`}</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span>Payments secured by Square</span>
        </div>
      </div>
    </footer>
  );
};
