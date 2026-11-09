// Landing page: hero with a city + category search, categories, how booking works, featured pros,
// promo banners, pros by category, a call to pros and shop owners, and shops with booths for rent.
// Everything shown is real data from the site; sections without enough data are left out.
import React, { useMemo, useRef, useState } from 'react';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import { Markdown } from '../lib/markdown';
import { Button, cx, useApi } from '../components/ui';
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon, CategoryIcon, ChatIcon, CreditCardIcon, LocationIcon, SearchIcon, StoreIcon } from '../components/Icons';
import { ArtistCard, ArtistCardSkeleton } from './Artists';
import { ShopCard } from './Shops';
import type { PublicArtist, Shop } from '../../shared/types';

/** The owner's categories with how many pros list under each, busiest first. */
function categoryCounts(categories: string[], pros: PublicArtist[]) {
  return categories
    .map((name, i) => ({ name, count: pros.filter(p => p.categories.includes(name)).length, order: i }))
    .sort((a, b) => b.count - a.count || a.order - b.order);
}

const SectionTitle: React.FC<{ title: string; subtitle?: string; center?: boolean; children?: React.ReactNode }> = ({ title, subtitle, center, children }) => (
  <div className={cx('mb-10 flex gap-4', center ? 'flex-col items-center text-center' : 'items-end justify-between')}>
    <div>
      <h2 className="text-3xl md:text-[2.75rem] md:leading-tight font-display">{title}</h2>
      {subtitle && <p className="mt-2 text-brand-gray max-w-xl">{subtitle}</p>}
    </div>
    {children}
  </div>
);

/** A horizontally scrolling row with previous/next buttons; on phones it is swiped. */
const Carousel: React.FC<{ title: string; label: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, label, action, children }) => {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9, behavior: 'smooth' });
  const arrow = 'w-11 h-11 rounded-full flex items-center justify-center bg-brand-solid text-on-primary shadow-lg shadow-brand-primary/25 hover:brightness-110 transition enabled:active:scale-95';
  return (
    <section>
      <SectionTitle title={title}>
        <div className="flex items-center gap-3 flex-shrink-0">
          {action}
          <div className="hidden sm:flex gap-2">
            <button type="button" className={arrow} onClick={() => scroll(-1)} aria-label={`Previous ${label}`}><ArrowLeftIcon className="w-5 h-5" /></button>
            <button type="button" className={arrow} onClick={() => scroll(1)} aria-label={`Next ${label}`}><ArrowRightIcon className="w-5 h-5" /></button>
          </div>
        </div>
      </SectionTitle>
      <div ref={track} className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-6 -mb-6 overscroll-x-contain">
        {children}
      </div>
    </section>
  );
};
const slide = 'snap-start flex-shrink-0 w-[82%] sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)] flex';

const STEPS = [
  { Icon: SearchIcon, title: 'Find your pro', text: 'Search by category, city and day, then look through their work, prices and reviews.' },
  { Icon: ChatIcon, title: 'Send your request', text: 'Pick a service and a day, say what you would like and add photos if you have them.' },
  { Icon: CreditCardIcon, title: 'Pay the deposit', text: 'When your pro approves, a deposit paid safely online holds your spot.' },
  { Icon: CalendarIcon, title: 'Show up', text: 'Your booking, messages and receipt stay in one place. Leave a review after.' },
];

export const HomePage: React.FC = () => {
  const s = useStore(st => st.config!.settings);
  const user = useStore(st => st.user);
  const openAuth = useStore(st => st.openAuth);
  const artists = useApi<PublicArtist[]>(s.features.clientBooking ? '/artists' : null);
  const shops = useApi<Shop[]>(s.features.boothRental ? '/shops' : null);
  const list = artists.data ?? [];
  const cats = useMemo(() => categoryCounts(s.categories, list), [s.categories, list]);
  // Categories with pros first; if only a few are filled yet, show the whole list so the site doesn't look empty.
  const shownCats = cats.filter(c => c.count > 0).length >= 4 ? cats.filter(c => c.count > 0) : cats;
  const cities = useMemo(() => [...new Set([...list.map(a => a.city), ...(shops.data ?? []).map(sh => sh.city)].filter(Boolean))].sort(), [list, shops.data]);
  const mosaic = list.flatMap(a => a.portfolio.slice(0, 2).map(p => p.url)).slice(0, 8);

  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (city.trim()) q.set('city', city.trim());
    if (category && s.features.clientBooking) q.set('category', category);
    navigate(`${s.features.clientBooking ? '/artists' : '/shops'}${q.toString() ? `?${q}` : ''}`);
  };

  const [filter, setFilter] = useState('');
  const byCategory = (filter ? list.filter(a => a.categories.includes(filter)) : list).slice(0, 8);
  // One piece each from different categories where possible, for the banners.
  const showcase = [...new Map(list.filter(a => a.portfolio[0]).map(a => [a.category, a])).values(), ...list]
    .filter(a => a.portfolio[0])
    .map(a => ({ url: a.portfolio[0].url, alt: a.portfolio[0].caption || `Work by ${a.name}` }))
    .filter((p, i, all) => all.findIndex(q => q.url === p.url) === i)
    .slice(0, 3);

  return (
    <div>
      {/* Hero: the owner's photo if set, otherwise a mosaic of real work, under a dark overlay. */}
      <section className="relative isolate overflow-hidden bg-brand-dark text-white">
        {s.heroImageUrl ? (
          <img src={s.heroImageUrl} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
        ) : (
          mosaic.length >= 4 && (
            <div aria-hidden="true" className="absolute inset-0 -z-10 grid grid-cols-2 sm:grid-cols-4 grid-rows-2">
              {mosaic.map(url => <img key={url} src={url} alt="" className="w-full h-full object-cover" />)}
            </div>
          )
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-950/85 via-gray-950/75 to-gray-950/90" />
        <div className="container mx-auto px-4 pt-[calc(var(--header-h,4.5rem)+3.5rem)] pb-28 md:pt-[calc(var(--header-h,4.5rem)+8rem)] md:pb-44 text-center">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[4rem] lg:leading-[1.15] max-w-4xl mx-auto">
            {s.heroTitle}
            {s.heroHighlight && <span className="block text-[rgb(var(--brand-primary-text-dark))]">{s.heroHighlight}</span>}
          </h1>
          {s.heroSubtitle && <p className="mt-5 text-lg text-gray-200 max-w-2xl mx-auto">{s.heroSubtitle}</p>}
          {(s.features.clientBooking || s.features.boothRental) && (
            <form
              onSubmit={search}
              role="search"
              className="mt-10 mx-auto max-w-2xl bg-white dark:bg-gray-900 text-brand-dark dark:text-white rounded-2xl sm:rounded-full p-2 shadow-2xl shadow-black/30 flex flex-col sm:flex-row sm:items-center gap-1"
            >
              <label className="flex items-center gap-2 flex-1 px-4 py-2.5 min-w-0">
                <LocationIcon className="w-5 h-5 text-brand-primary" />
                <input
                  aria-label="City"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  list="home-cities"
                  placeholder="City"
                  autoComplete="address-level2"
                  enterKeyHint="search"
                  className="w-full bg-transparent outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
                <datalist id="home-cities">{cities.map(c => <option key={c} value={c} />)}</datalist>
              </label>
              {s.features.clientBooking && (
                <>
                  <span aria-hidden="true" className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-gray-700" />
                  <span aria-hidden="true" className="sm:hidden h-px mx-4 bg-gray-200 dark:bg-gray-700" />
                  <label className="flex items-center gap-2 flex-1 px-4 py-2.5 min-w-0">
                    <StoreIcon className="w-5 h-5 text-brand-primary" />
                    <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent outline-none appearance-none cursor-pointer">
                      <option value="">All categories</option>
                      {s.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </>
              )}
              <Button type="submit" size="lg" className="sm:flex-shrink-0">
                <SearchIcon className="w-5 h-5" /> {s.features.clientBooking ? 'Find pros' : 'Find shops'}
              </Button>
            </form>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4">
        {s.features.clientBooking && shownCats.length > 0 && (
          <section className="py-20 md:py-24">
            <SectionTitle title="Browse by category" subtitle="Tattoo artists, barbers, nail techs, lash artists and more, all in one place." center />
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {shownCats.slice(0, 8).map(c => (
                <li key={c.name}>
                  <Link
                    to={`/artists?category=${encodeURIComponent(c.name)}`}
                    className="group flex items-center gap-4 h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 transition-shadow hover:shadow-xl hover:shadow-gray-900/[0.07] dark:hover:shadow-black/40"
                  >
                    <span className="flex-shrink-0 w-14 h-14 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center transition-colors group-hover:bg-brand-solid group-hover:text-on-primary">
                      <CategoryIcon category={c.name} className="w-7 h-7" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold font-display line-clamp-2 group-hover:text-brand-primary transition-colors">{c.name}</span>
                      <span className="block text-sm text-brand-gray mt-0.5">{c.count === 0 ? 'Coming soon' : c.count === 1 ? '1 pro' : `${c.count} pros`}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {s.features.clientBooking && (
        <section className="bg-brand-tint dark:bg-gray-900/50 py-20 md:py-24">
          <div className="container mx-auto px-4">
            <SectionTitle title="How booking works" subtitle="From first idea to appointment in four steps." center />
            <ol className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ Icon, title, text }, i) => (
                <li key={title} className="relative pt-9">
                  {/* Outlined step number over the card's top-left corner. */}
                  <span aria-hidden="true" className="absolute top-0 left-0 z-10 font-display font-bold text-6xl leading-none text-transparent [-webkit-text-stroke:1.5px_rgb(var(--brand-primary))]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="relative ml-5 h-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 p-6 shadow-sm">
                    <span className="w-12 h-12 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center"><Icon className="w-6 h-6" /></span>
                    <h3 className="mt-4 text-lg font-semibold"><span className="sr-only">Step {i + 1}: </span>{title}</h3>
                    <p className="mt-1 text-sm text-brand-gray">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 space-y-20 md:space-y-24 py-20 md:py-24">
        {s.features.clientBooking && (artists.loading || list.length > 0) && (
          <Carousel title="Featured pros" label="pros" action={<Link to="/artists" className="hidden md:inline text-sm font-medium text-brand-primary hover:underline">View all</Link>}>
            {artists.data
              ? list.slice(0, 8).map(a => <div key={a.id} className={slide}><ArtistCard artist={a} /></div>)
              : Array.from({ length: 4 }, (_, i) => <div key={i} className={slide}><div className="w-full"><ArtistCardSkeleton /></div></div>)}
          </Carousel>
        )}

        {(s.features.boothRental || s.features.clientBooking) && (
          <section className="grid gap-6 md:grid-cols-2">
            {s.features.clientBooking && (
              <PromoBanner
                title="Ready for a fresh look?"
                text="Book a barber, nail tech, lash artist or tattoo artist near you."
                action="Find a pro"
                to="/artists"
                image={showcase[0]}
              />
            )}
            {s.features.boothRental && (
              <PromoBanner
                title="Need a chair for a few days?"
                text="Shops and salons rent booths and chairs to visiting pros by the day."
                action="Find a booth"
                to="/shops"
                image={shops.data?.find(sh => sh.imageUrl) ? { url: shops.data.find(sh => sh.imageUrl)!.imageUrl!, alt: '' } : showcase[1]}
              />
            )}
          </section>
        )}

        {s.features.clientBooking && list.length >= 4 && cats.filter(c => c.count > 0).length >= 2 && (
          <section>
            <SectionTitle title="Popular pros" center />
            <div className="flex flex-wrap justify-center gap-2 -mt-4 mb-10" role="group" aria-label="Filter pros by category">
              {[{ id: '', label: 'All' }, ...cats.filter(c => c.count > 0).slice(0, 6).map(c => ({ id: c.name, label: c.name }))].map(o => (
                <button
                  key={o.id || 'all'}
                  type="button"
                  aria-pressed={filter === o.id}
                  onClick={() => setFilter(o.id)}
                  className={cx(
                    'px-5 py-2 rounded-full text-sm font-medium border transition-colors',
                    filter === o.id ? 'bg-brand-solid text-on-primary border-transparent shadow-lg shadow-brand-primary/25' : 'border-gray-300 dark:border-gray-700 hover:border-brand-primary hover:text-brand-primary',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {byCategory.map((a, i) => (
                <div key={a.id} className={cx('flex', i >= 4 && 'hidden sm:flex')}>
                  <ArtistCard artist={a} />
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button size="lg" onClick={() => navigate(filter ? `/artists?category=${encodeURIComponent(filter)}` : '/artists')}>View all pros</Button>
            </div>
          </section>
        )}

        {!user && (
          <section className="relative overflow-hidden rounded-3xl bg-gray-950 text-white dark:border dark:border-gray-800">
            <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center">
              <div className="p-8 sm:p-12 lg:p-16">
                <h2 className="font-display text-3xl md:text-[2.75rem] md:leading-tight">Do you take bookings?</h2>
                <p className="mt-4 text-gray-300 max-w-md">
                  Tattoo artists, barbers, nail techs, lash artists and other pros: create a free profile to take bookings and deposits online
                  {s.features.boothRental ? '. Shop and salon owners can list booths and chairs for visiting pros' : ''}.
                </p>
                <Button size="lg" className="mt-8" onClick={() => openAuth('register')}>Create a free profile</Button>
              </div>
              {showcase.length >= 2 && (
                <div aria-hidden="true" className="relative hidden md:block h-full min-h-[320px]">
                  {/* Two pieces laid down like prints on a table. */}
                  <img src={showcase[0].url} alt="" className="absolute right-[38%] top-10 w-52 aspect-[4/5] object-cover rounded-xl border-4 border-white shadow-2xl -rotate-6" />
                  <img src={showcase[1].url} alt="" className="absolute right-[12%] top-20 w-52 aspect-[4/5] object-cover rounded-xl border-4 border-white shadow-2xl rotate-6" />
                </div>
              )}
            </div>
          </section>
        )}

        {s.features.boothRental && shops.data && shops.data.length > 0 && (
          <Carousel title="Booths for rent" label="shops" action={<Button variant="outline" onClick={() => navigate('/shops')} className="hidden md:inline-flex">View all shops</Button>}>
            {shops.data.slice(0, 8).map(sh => <div key={sh.id} className={slide}><ShopCard shop={sh} /></div>)}
          </Carousel>
        )}

        {s.aboutText && (
          <section className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-display">{s.aboutTitle}</h2>
            <Markdown text={s.aboutText} className="mt-4 text-lg leading-relaxed text-brand-gray" />
          </section>
        )}
      </div>
    </div>
  );
};

const PromoBanner: React.FC<{ title: string; text: string; action: string; to: string; image?: { url: string; alt: string } }> = ({ title, text, action, to, image }) => (
  <div className="relative overflow-hidden rounded-2xl bg-brand-tint dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 flex min-h-[220px]">
    <div className="relative z-10 p-6 sm:p-9 flex flex-col justify-center max-w-[68%] sm:max-w-[62%]">
      <h3 className="text-xl sm:text-[1.75rem] sm:leading-tight font-display">{title}</h3>
      <p className="mt-2 text-sm text-brand-gray">{text}</p>
      <div className="mt-5">
        <Button onClick={() => navigate(to)}>{action}</Button>
      </div>
    </div>
    {image && (
      <img
        src={image.url}
        alt={image.alt}
        loading="lazy"
        className="absolute right-0 top-0 h-full w-[34%] sm:w-[42%] object-cover [mask-image:linear-gradient(to_right,transparent,black_35%)]"
      />
    )}
  </div>
);
