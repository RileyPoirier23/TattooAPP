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
    <footer className="mt-20 border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            {s.logoUrl ? <img src={s.logoUrl} alt={s.siteName} className="h-8 w-auto" /> : <NeedleIcon className="w-7 h-7 text-brand-primary" />}
            <span className="text-lg font-extrabold">{s.siteName}</span>
          </div>
          <p className="text-sm text-brand-gray mt-2 max-w-xs">{s.tagline}</p>
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
          <h4 className="font-semibold mb-3">Explore</h4>
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
          <h4 className="font-semibold mb-3">Contact</h4>
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
      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-5 text-xs text-brand-gray flex flex-col sm:flex-row justify-between gap-2">
          <span>{s.footerText || `© ${new Date().getFullYear()} ${s.siteName}. All rights reserved.`}</span>
          <span>Payments secured by Square</span>
        </div>
      </div>
    </footer>
  );
};
