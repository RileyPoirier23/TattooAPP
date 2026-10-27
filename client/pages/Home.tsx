// Landing page: admin-editable hero + about, real work from the site's artists, featured artists and shops.
import React from 'react';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import { Markdown } from '../lib/markdown';
import { Button, useApi } from '../components/ui';
import { ArtistCard, ArtistCardSkeleton } from './Artists';
import { ShopCard } from './Shops';
import type { PublicArtist, Shop } from '../../shared/types';

/** Three recent pieces from different artists, linking to their profiles. Shown beside the headline. */
const WorkPreview: React.FC<{ artists: PublicArtist[] }> = ({ artists }) => {
  const picks = artists.filter(a => a.portfolio.length > 0).slice(0, 3);
  if (picks.length < 3) return null;
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-3 h-[26rem]" aria-label="Recent work">
      {picks.map((a, i) => (
        <Link key={a.id} to={`/artists/${a.id}`} className={`group relative overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 ${i === 0 ? 'row-span-2' : ''}`}>
          <img src={a.portfolio[0].url} alt={a.portfolio[0].caption || `Tattoo by ${a.name}`} className="w-full h-full object-cover" />
          <span className="absolute left-2 bottom-2 max-w-[calc(100%-1rem)] truncate rounded bg-black/75 px-2 py-1 text-xs text-white">
            {a.name}{a.specialty ? ` · ${a.specialty}` : ''}
          </span>
        </Link>
      ))}
    </div>
  );
};

export const HomePage: React.FC = () => {
  const s = useStore(st => st.config!.settings);
  const user = useStore(st => st.user);
  const openAuth = useStore(st => st.openAuth);
  const artists = useApi<PublicArtist[]>(s.features.clientBooking ? '/artists' : null);
  const shops = useApi<Shop[]>(s.features.boothRental ? '/shops' : null);
  const onPhoto = !!s.heroImageUrl;
  const preview = !onPhoto && artists.data ? <WorkPreview artists={artists.data} /> : null;

  return (
    <div>
      <section className={`relative ${onPhoto ? 'text-white' : ''}`}>
        {onPhoto && (
          <>
            <img src={s.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60" />
          </>
        )}
        <div className={`relative container mx-auto px-4 ${onPhoto ? 'py-24 md:py-32' : 'py-12 md:py-20'} grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center`}>
          <div className="max-w-xl">
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05]">
              {s.heroTitle}
              {s.heroHighlight && <span className={`block ${onPhoto ? '' : 'text-brand-primary'}`}>{s.heroHighlight}</span>}
            </h1>
            {s.heroSubtitle && <p className={`mt-5 text-lg leading-relaxed ${onPhoto ? 'text-gray-200' : 'text-brand-gray'}`}>{s.heroSubtitle}</p>}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {s.features.clientBooking && (
                <Button size="lg" onClick={() => navigate('/artists')} className="w-full sm:w-auto">Find an artist</Button>
              )}
              {s.features.boothRental && (
                <Button size="lg" variant="outline" onClick={() => navigate('/shops')} className={`w-full sm:w-auto ${onPhoto ? 'text-white border-white/50 hover:bg-white/10' : ''}`}>
                  Find a guest spot
                </Button>
              )}
            </div>
          </div>
          {preview && <div className="hidden lg:block">{preview}</div>}
        </div>
      </section>

      <div className="container mx-auto px-4 space-y-16 md:space-y-20 pb-4">
        <section className="grid gap-8 md:grid-cols-2 border-t border-gray-300 dark:border-gray-800 pt-10">
          {s.features.clientBooking && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-gray">Getting tattooed</h2>
              <p className="mt-3 text-lg leading-relaxed">
                Look through an artist&apos;s portfolio, prices and hours, then send your idea with the size, placement and reference photos.
                When they approve it, a deposit holds your date{s.features.messaging ? ' and you can work out the design together in messages' : ''}.
              </p>
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-gray">For artists and shops</h2>
            <p className="mt-3 text-lg leading-relaxed">
              Artists take requests and deposits online{s.features.boothRental ? ' and book guest spots at shops in other cities' : ''}.
              {s.features.boothRental ? ' Shops list their chairs by the day and get paid when an artist reserves one.' : ''}
            </p>
          </div>
        </section>

        {s.features.clientBooking && (artists.loading || (artists.data && artists.data.length > 0)) && (
          <section>
            <div className="flex items-baseline justify-between gap-4 mb-6">
              <h2 className="font-display text-3xl">Artists</h2>
              <Link to="/artists" className="text-sm font-semibold text-brand-primary underline underline-offset-4 decoration-1">See all artists</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {artists.data
                ? artists.data.slice(0, 4).map(a => <ArtistCard key={a.id} artist={a} />)
                : Array.from({ length: 4 }, (_, i) => <ArtistCardSkeleton key={i} />)}
            </div>
          </section>
        )}

        {s.features.boothRental && shops.data && shops.data.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between gap-4 mb-6">
              <h2 className="font-display text-3xl">Shops with guest spots</h2>
              <Link to="/shops" className="text-sm font-semibold text-brand-primary underline underline-offset-4 decoration-1">See all shops</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shops.data.slice(0, 3).map(sh => <ShopCard key={sh.id} shop={sh} />)}
            </div>
          </section>
        )}

        {s.aboutText && (
          <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] border-t border-gray-300 dark:border-gray-800 pt-10">
            <h2 className="font-display text-3xl">{s.aboutTitle}</h2>
            <Markdown text={s.aboutText} className="text-lg leading-relaxed text-brand-gray max-w-2xl" />
          </section>
        )}

        {!user && (
          <section className="rounded-lg bg-brand-dark text-brand-light dark:bg-gray-900 dark:border dark:border-gray-800 p-8 md:p-12 md:flex md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl">Tattoo artist or shop owner?</h2>
              <p className="mt-2 text-gray-300">A profile is free. Take bookings and deposits online, or list your chairs for guest artists.</p>
            </div>
            <button
              onClick={() => openAuth('register')}
              className="mt-6 md:mt-0 flex-shrink-0 inline-flex items-center justify-center font-semibold px-6 py-3 rounded-lg bg-brand-light text-brand-dark hover:bg-white transition-colors"
            >
              Create a profile
            </button>
          </section>
        )}
      </div>
    </div>
  );
};
