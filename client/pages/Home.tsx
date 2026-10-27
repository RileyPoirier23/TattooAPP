// Landing page, laid out like a tattoo flash sheet: a poster headline set around real work from the site's
// artists, live counts, a ticker of styles, a numbered sheet of recent pieces, then artists and shops.
import React from 'react';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import { Markdown } from '../lib/markdown';
import { Button, catalogCell, catalogGrid, catalogNo, cx, useApi } from '../components/ui';
import { ArtistCard, ArtistCardSkeleton } from './Artists';
import { ShopCard } from './Shops';
import type { PublicArtist, Shop } from '../../shared/types';

type Piece = { url: string; caption?: string; artist: PublicArtist };

/** Up to `max` portfolio pieces, taking turns between artists so one artist doesn't fill the sheet. */
function recentWork(artists: PublicArtist[], max: number): Piece[] {
  const out: Piece[] = [];
  for (let round = 0; out.length < max; round++) {
    const next = artists.filter(a => a.portfolio[round]).map(a => ({ ...a.portfolio[round], artist: a }));
    if (!next.length) break;
    out.push(...next.slice(0, max - out.length));
  }
  return out;
}

/** The headline, with two small photos set into the line between words (decorative). */
const PosterTitle: React.FC<{ title: string; highlight: string; photos: string[]; onPhoto: boolean }> = ({ title, highlight, photos, onPhoto }) => {
  const words = title.split(/\s+/).filter(Boolean);
  const chip = (url: string) => (
    <span aria-hidden="true" className="inline-block align-middle w-[1.45em] h-[0.7em] mx-[0.1em] -translate-y-[0.05em] overflow-hidden border-[0.04em] border-current">
      <img src={url} alt="" className="w-full h-full object-cover" />
    </span>
  );
  return (
    <h1 className="font-display font-black text-[clamp(3.25rem,11vw,10.5rem)] leading-[0.84]">
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {i === words.length - 1 && words.length >= 3 && photos[1] && <>{chip(photos[1])} </>}
          {w}
          {i < words.length - 1 && ' '}
          {i === 0 && words.length >= 2 && photos[0] && <>{chip(photos[0])} </>}
        </React.Fragment>
      ))}
      {highlight && <span className={cx('block', !onPhoto && 'text-brand-primary')}>{highlight}</span>}
    </h1>
  );
};

const SectionHead: React.FC<{ no: string; title: string; to?: string; linkLabel?: string }> = ({ no, title, to, linkLabel }) => (
  <div className="flex items-end justify-between gap-4 mb-4">
    <h2 className="font-display text-5xl sm:text-7xl">
      <span className="label align-top mr-3 text-brand-primary">({no})</span>
      {title}
    </h2>
    {to && <Link to={to} className="label flex-shrink-0 pb-2 underline underline-offset-4 hover:text-brand-primary">{linkLabel}</Link>}
  </div>
);

/** A slowly scrolling band of the site's tattoo styles. Decorative; it stops for people who ask for reduced motion. */
const StyleTicker: React.FC<{ styles: string[] }> = ({ styles }) => {
  if (styles.length < 3) return null;
  const run = (copy: number) => styles.map(st => (
    <span key={`${copy}-${st}`} className="flex items-center gap-6 pr-6">
      <span>{st}</span>
      <span className="w-2 h-2 bg-brand-primary" />
    </span>
  ));
  return (
    <div aria-hidden="true" className="overflow-hidden border-y border-gray-900 dark:border-gray-700 bg-brand-dark text-brand-light py-3">
      <div className="ticker flex w-max font-display text-3xl whitespace-nowrap">{run(0)}{run(1)}</div>
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
  // The feature piece fills 2×2 cells, so 5 or 9 pieces fill the 2- and 4-column sheets with no gaps.
  const pool = artists.data ? recentWork(artists.data, 9) : [];
  const work = pool.slice(0, pool.length >= 9 ? 9 : 5);
  const cities = new Set([...(artists.data ?? []).map(a => a.city), ...(shops.data ?? []).map(sh => sh.city)].filter(Boolean));
  // Live counts, shown only once there is something to count.
  const stats = [
    artists.data?.length ? { n: artists.data.length, label: artists.data.length === 1 ? 'Artist' : 'Artists' } : null,
    shops.data?.length ? { n: shops.data.length, label: shops.data.length === 1 ? 'Shop' : 'Shops' } : null,
    cities.size ? { n: cities.size, label: cities.size === 1 ? 'City' : 'Cities' } : null,
  ].filter(Boolean) as { n: number; label: string }[];

  return (
    <div>
      <section className={cx('relative', onPhoto && 'text-white')}>
        {onPhoto && (
          <>
            <img src={s.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/65" />
          </>
        )}
        <div className="relative container mx-auto px-4 pt-6 pb-10 md:pb-14">
          <div className={cx('label flex justify-between gap-4 pb-6', onPhoto ? 'text-gray-200' : 'text-brand-gray')}>
            <span>{s.tagline}</span>
            {cities.size > 0 && <span className="hidden sm:inline">{[...cities].slice(0, 3).join(' / ')}</span>}
          </div>
          <PosterTitle title={s.heroTitle} highlight={s.heroHighlight} photos={onPhoto ? [] : work.slice(0, 2).map(p => p.url)} onPhoto={onPhoto} />
          <div className={cx('mt-10 pt-6 border-t grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end', onPhoto ? 'border-white/40' : 'border-gray-900 dark:border-gray-700')}>
            <div className="max-w-xl">
              {s.heroSubtitle && <p className={cx('text-lg leading-relaxed', onPhoto ? 'text-gray-100' : 'text-gray-700 dark:text-gray-300')}>{s.heroSubtitle}</p>}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {s.features.clientBooking && <Button size="lg" onClick={() => navigate('/artists')} className="w-full sm:w-auto">Find an artist</Button>}
                {s.features.boothRental && (
                  <Button size="lg" variant="outline" onClick={() => navigate('/shops')} className={cx('w-full sm:w-auto', onPhoto && 'text-white border-white hover:bg-white hover:text-brand-dark')}>
                    Find a guest spot
                  </Button>
                )}
              </div>
            </div>
            {stats.length > 0 && (
              <dl className="flex gap-8 sm:gap-12">
                {stats.map(st => (
                  <div key={st.label}>
                    <dt className={cx('label', onPhoto ? 'text-gray-200' : 'text-brand-gray')}>{st.label}</dt>
                    <dd className="font-display text-6xl sm:text-7xl tabular-nums leading-none mt-1">{st.n}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      <StyleTicker styles={s.specialties} />

      <div className="container mx-auto px-4 space-y-20 md:space-y-28 pt-16 md:pt-20">
        {work.length >= 5 && (
          <section>
            <SectionHead no="01" title="Recent work" />
            {/* A sheet of pieces: the first is the feature, the rest fill the grid around it. */}
            <div className={cx(catalogGrid, 'grid-cols-2 md:grid-cols-4')}>
              {work.map((p, i) => (
                <Link
                  key={`${p.artist.id}-${p.url}`}
                  to={`/artists/${p.artist.id}`}
                  className={cx('group relative overflow-hidden aspect-square', catalogCell, i === 0 && 'col-span-2 row-span-2')}
                >
                  <img src={p.url} alt={p.caption || `Tattoo by ${p.artist.name}`} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 ease-out-strong motion-safe:group-hover:scale-[1.04]" />
                  <span className="label absolute left-0 bottom-0 max-w-full truncate bg-brand-dark text-brand-light px-2 py-1 transition-colors group-hover:bg-brand-solid group-hover:text-on-primary">
                    {catalogNo(i)} · {p.artist.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {s.features.clientBooking && (artists.loading || (artists.data && artists.data.length > 0)) && (
          <section>
            <SectionHead no="02" title="Artists" to="/artists" linkLabel={artists.data ? `See all ${artists.data.length}` : 'See all'} />
            <div className={cx(catalogGrid, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4')}>
              {artists.data
                ? artists.data.slice(0, 4).map((a, i) => <ArtistCard key={a.id} artist={a} index={i} />)
                : Array.from({ length: 4 }, (_, i) => <ArtistCardSkeleton key={i} />)}
            </div>
          </section>
        )}

        <section className="grid gap-10 md:grid-cols-2">
          {s.features.clientBooking && (
            <div className="border-t border-gray-900 dark:border-gray-700 pt-5">
              <p className="label text-brand-primary">Getting tattooed</p>
              <p className="mt-4 text-xl leading-snug">
                Look through an artist&apos;s portfolio, prices and hours, then send your idea with the size, placement and reference photos.
                When they approve it, a deposit holds your date{s.features.messaging ? ' and you can work out the design together in messages' : ''}.
              </p>
            </div>
          )}
          <div className="border-t border-gray-900 dark:border-gray-700 pt-5">
            <p className="label text-brand-primary">For artists and shops</p>
            <p className="mt-4 text-xl leading-snug">
              Artists take requests and deposits online{s.features.boothRental ? ' and book guest spots at shops in other cities' : ''}.
              {s.features.boothRental ? ' Shops list their chairs by the day and get paid when an artist reserves one.' : ''}
            </p>
          </div>
        </section>

        {s.features.boothRental && shops.data && shops.data.length > 0 && (
          <section>
            <SectionHead no="03" title="Guest spots" to="/shops" linkLabel={`See all ${shops.data.length}`} />
            <div className={cx(catalogGrid, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
              {shops.data.slice(0, 3).map((sh, i) => <ShopCard key={sh.id} shop={sh} index={i} />)}
            </div>
          </section>
        )}

        {s.aboutText && (
          <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] border-t border-gray-900 dark:border-gray-700 pt-6">
            <h2 className="font-display text-5xl">{s.aboutTitle}</h2>
            <Markdown text={s.aboutText} className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 max-w-2xl" />
          </section>
        )}
      </div>

      {!user && (
        <section className="mt-20 md:mt-28 bg-brand-solid text-on-primary">
          <div className="container mx-auto px-4 py-14 md:py-20 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <p className="label">Free to join</p>
              <h2 className="font-display font-black text-6xl md:text-8xl mt-3">Tattoo artist or shop owner?</h2>
              <p className="mt-4 max-w-xl text-lg">Take bookings and deposits online, or list your chairs for guest artists.</p>
            </div>
            <button
              onClick={() => openAuth('register')}
              className="font-mono text-sm font-medium uppercase tracking-wider px-8 py-5 bg-brand-dark text-brand-light hover:bg-brand-light hover:text-brand-dark transition-colors enabled:active:scale-[0.97]"
            >
              Create a profile
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
