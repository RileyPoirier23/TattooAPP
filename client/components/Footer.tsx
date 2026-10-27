// Site footer with admin-managed links, socials and pages.
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

  return (
    <footer className="mt-24 pb-[env(safe-area-inset-bottom)] border-t border-gray-900 dark:border-gray-700 overflow-hidden">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          {s.logoUrl && <img src={s.logoUrl} alt={s.siteName} className="h-8 w-auto mb-3" />}
          <p className="text-sm text-brand-gray max-w-xs">{s.tagline}</p>
          {socials.length > 0 && (
            <div className="flex gap-3 mt-4">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-brand-gray hover:text-brand-primary">
                  <Icon className="w-6 h-6" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="label mb-3">Explore</h4>
          <ul className="space-y-2 text-sm text-brand-gray">
            {s.features.clientBooking && <li><Link to="/artists" className="hover:text-brand-primary">Find an artist</Link></li>}
            {s.features.boothRental && <li><Link to="/shops" className="hover:text-brand-primary">Guest spots & booths</Link></li>}
            {pages.map(p => (
              <li key={p.slug}>
                <Link to={`/p/${p.slug}`} className="hover:text-brand-primary">{p.title}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="label mb-3">Contact</h4>
          <ul className="space-y-2 text-sm text-brand-gray">
            <li>
              <Link to="/contact" className="hover:text-brand-primary">Contact us</Link>
            </li>
            {s.contactEmail && (
              <li>
                <a href={`mailto:${s.contactEmail}`} className="hover:text-brand-primary">{s.contactEmail}</a>
              </li>
            )}
            {s.instagramUrl && (
              <li>
                <a href={s.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary">DM us on Instagram</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      {/* The site name as a poster across the full width. */}
      <div className="container mx-auto px-4" aria-hidden="true">
        <p className="font-display text-[clamp(4rem,17vw,15rem)] leading-[0.8] text-brand-dark dark:text-white whitespace-nowrap overflow-hidden -mb-[0.06em] flex items-end gap-[0.08em]">
          {!s.logoUrl && <NeedleIcon className="w-[0.6em] h-[0.6em] text-brand-primary mb-[0.08em]" />}
          <span className="truncate">{s.siteName}</span>
        </p>
      </div>
      <div className="border-t border-gray-900 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 label text-brand-gray flex flex-col sm:flex-row justify-between gap-2">
          <span>{s.footerText || `© ${new Date().getFullYear()} ${s.siteName}. All rights reserved.`}</span>
          <span>Payments secured by Square</span>
        </div>
      </div>
    </footer>
  );
};
