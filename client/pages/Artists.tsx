// Pro directory (any category) with search, filters and sorting, laid out like the template's services page.
import React, { useMemo, useState } from 'react';
import { Link, navigate, useLocation } from '../router';
import { useStore } from '../store';
import { cityFromCoords } from '../lib/maps';
import { dollars, formatDate, today } from '../lib/format';
import { Avatar, Badge, Button, Card, Cover, EmptyState, ErrorBox, Input, PageBanner, Select, Skeleton, SkeletonGrid, Toggle, cx, inputClass, useApi } from '../components/ui';
import { CalendarIcon, CheckBadgeIcon, CrosshairsIcon, LocationIcon, SearchIcon, StarIcon } from '../components/Icons';
import type { PublicArtist } from '../../shared/types';

/** The lowest starting price across an artist's services, if they list any. */
export const fromPrice = (a: PublicArtist) => (a.services.length ? Math.min(...a.services.map(s => s.price)) : null);

export const ArtistCard: React.FC<{ artist: PublicArtist }> = ({ artist }) => {
  const price = fromPrice(artist);
  return (
    <Link
      to={`/artists/${artist.id}`}
      className="group w-full flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 transition-shadow hover:shadow-xl hover:shadow-gray-900/[0.07] dark:hover:shadow-black/40"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
        <Cover
          url={artist.portfolio[0]?.url || artist.avatarUrl}
          alt={artist.name}
          className="w-full h-full transition-transform duration-500 ease-out-strong motion-safe:group-hover:scale-[1.04]"
        />
        <div className="absolute top-2 left-2 right-2 flex justify-between gap-2">
          {artist.isVerified ? <Badge tone="none" className="bg-white/95 text-gray-900"><CheckBadgeIcon className="w-3.5 h-3.5 text-brand-secondary" />Verified</Badge> : <span />}
          {artist.isPro && <Badge tone="none" className="bg-brand-solid text-on-primary">Pro</Badge>}
        </div>
        {artist.guestSpot && (
          <div className="absolute bottom-2 left-2 right-2" title={`Guest spot in ${artist.guestSpot.city}`}>
            <Badge tone="none" className="bg-gray-900/85 text-white max-w-full"><CalendarIcon className="w-3.5 h-3.5" /><span className="truncate">Guest spot in {artist.guestSpot.city}</span></Badge>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col px-2 pt-3 pb-1">
        <div className="flex items-center justify-between gap-3 text-sm text-brand-gray">
          <span className="truncate">{[artist.category, artist.specialty].filter(Boolean).join(' · ') || 'Pro'}</span>
          {artist.reviewCount > 0 && (
            <span className="flex-shrink-0 flex items-center gap-1 text-gray-800 dark:text-gray-200">
              <StarIcon className="w-4 h-4 text-amber-400" />{artist.averageRating.toFixed(1)}
              <span className="text-brand-gray">({artist.reviewCount.toLocaleString()})</span>
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold mt-1 group-hover:text-brand-primary transition-colors">{artist.name}</h3>
        <div className="flex items-center gap-2 mt-2 text-sm text-brand-gray">
          <Avatar name={artist.name} url={artist.avatarUrl} size="xs" />
          {artist.city ? <span className="flex items-center gap-1 min-w-0"><LocationIcon className="w-4 h-4" /><span className="truncate">{artist.city}</span></span> : <span>Location not listed</span>}
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
            <p className="text-sm text-brand-gray whitespace-nowrap">{price !== null ? <>From <strong className="text-base text-brand-dark dark:text-white">{dollars(price)}</strong></> : 'Custom quotes'}</p>
            <span className="flex-shrink-0 whitespace-nowrap rounded-full border border-gray-200 dark:border-gray-700 px-4 py-1.5 text-sm font-medium transition-colors group-hover:bg-brand-solid group-hover:text-on-primary group-hover:border-transparent">Book now</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export const ArtistCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5">
    <Skeleton className="aspect-[4/3] rounded-xl" />
    <div className="px-2 pt-3 pb-1 space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-full mt-3" />
    </div>
  </div>
);

const SORTS = {
  recommended: 'Recommended',
  rating: 'Top rated',
  reviews: 'Most reviewed',
  priceLow: 'Price: low to high',
  priceHigh: 'Price: high to low',
  name: 'Name (A to Z)',
} as const;
type Sort = keyof typeof SORTS;

const FilterBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
    <h2 className="text-lg font-semibold mb-3">{title}</h2>
    {children}
  </section>
);

export const ArtistsPage: React.FC = () => {
  const settings = useStore(s => s.config!.settings);
  const toast = useStore(s => s.toast);
  const { query } = useLocation();
  const [date, setDate] = useState(query.get('date') || '');
  const { data, error, loading, reload } = useApi<PublicArtist[]>(`/artists${date ? `?date=${date}` : ''}`);
  const [q, setQ] = useState(query.get('q') || '');
  const [city, setCity] = useState(query.get('city') || '');
  const [category, setCategory] = useState(query.get('category') || '');
  const [style, setStyle] = useState(query.get('style') || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('recommended');
  const [locating, setLocating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Every filter except the category, so the category list can show how many match each one.
  const matching = useMemo(() => {
    const term = q.trim().toLowerCase();
    const c = city.trim().toLowerCase();
    const lo = minPrice === '' ? null : Number(minPrice);
    const hi = maxPrice === '' ? null : Number(maxPrice);
    return (data || []).filter(a => {
      const price = fromPrice(a);
      return (
        (!term || [a.name, a.bio, a.specialty, a.category].some(v => v.toLowerCase().includes(term))) &&
        (!c || a.city.toLowerCase().includes(c) || a.address.toLowerCase().includes(c) || a.guestSpot?.city.toLowerCase().includes(c)) &&
        (!style || a.specialty.toLowerCase().includes(style.toLowerCase())) &&
        (lo === null || (price !== null && price >= lo)) &&
        (hi === null || (price !== null && price <= hi)) &&
        a.averageRating >= minRating &&
        (!verifiedOnly || a.isVerified)
      );
    });
  }, [data, q, city, style, minPrice, maxPrice, minRating, verifiedOnly]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of matching) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return m;
  }, [matching]);

  const results = useMemo(() => {
    const list = category ? matching.filter(a => a.category === category) : [...matching];
    const price = (a: PublicArtist, empty: number) => fromPrice(a) ?? empty;
    if (sort === 'rating') list.sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount);
    if (sort === 'reviews') list.sort((a, b) => b.reviewCount - a.reviewCount);
    if (sort === 'priceLow') list.sort((a, b) => price(a, Infinity) - price(b, Infinity));
    if (sort === 'priceHigh') list.sort((a, b) => price(b, -1) - price(a, -1));
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [matching, category, sort]);

  const nearMe = () => {
    if (!navigator.geolocation) return toast('Your browser does not support location.', 'error');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const found = await cityFromCoords(settings.googleMapsApiKey, pos.coords.latitude, pos.coords.longitude);
          if (found) setCity(found);
          else toast("Couldn't work out your city. Type it instead.", 'error');
        } catch {
          toast("Couldn't work out your city. Type it instead.", 'error');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast('Location permission was denied.', 'error');
      },
    );
  };

  const activeFilters = [q, city, category, style, date, minPrice, maxPrice].filter(Boolean).length + (minRating ? 1 : 0) + (verifiedOnly ? 1 : 0);
  const clear = () => {
    setQ('');
    setCity('');
    setCategory('');
    setStyle('');
    setDate('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating(0);
    setVerifiedOnly(false);
  };

  const visiting = city ? results.filter(a => a.guestSpot?.city.toLowerCase().includes(city.toLowerCase())) : [];
  const radio = (value: string, label: string, n: number) => (
    <label key={value || 'all'} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer group">
      <span className="flex items-center gap-2.5 min-w-0">
        <input type="radio" name="category" value={value} checked={category === value} onChange={() => setCategory(value)} className="w-4 h-4 accent-[rgb(var(--brand-solid))]" />
        <span className={cx('truncate', category === value ? 'text-brand-primary font-medium' : 'group-hover:text-brand-primary')}>{label}</span>
      </span>
      <span className="text-sm text-brand-gray tabular-nums">({n})</span>
    </label>
  );

  return (
    <div>
      <PageBanner title="Find a pro" crumbs={[{ label: 'Home', to: '/' }, { label: category || 'Pros' }]} />
      <div className="container mx-auto px-4 py-10 md:py-14 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] items-start">
        <div className="lg:hidden flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>
            {showFilters ? 'Hide filters' : 'Filters'}{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
          {activeFilters > 0 && <button onClick={clear} className="text-sm text-brand-gray hover:text-brand-primary">Clear all</button>}
        </div>

        <aside className={cx('space-y-5', !showFilters && 'hidden lg:block')} aria-label="Filters">
          <FilterBox title="Categories">
            <div role="radiogroup" aria-label="Category">
              {radio('', 'All', matching.length)}
              {settings.categories.map(c => radio(c, c, counts.get(c) ?? 0))}
            </div>
          </FilterBox>
          <FilterBox title="Search">
            <div className="space-y-3">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                <input type="search" enterKeyHint="search" className={`${inputClass} pl-10`} placeholder="Name or keyword" value={q} onChange={e => setQ(e.target.value)} aria-label="Search by name or keyword" />
              </div>
              <Select value={style} onChange={e => setStyle(e.target.value)} aria-label="Specialty">
                <option value="">Any specialty</option>
                {settings.specialties.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </FilterBox>
          <FilterBox title="Location & availability">
            <div className="space-y-3">
              <div className="relative">
                <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                <input className={`${inputClass} pl-10`} placeholder="City" value={city} onChange={e => setCity(e.target.value)} aria-label="City" />
              </div>
              {settings.googleMapsApiKey && (
                <Button variant="outline" size="sm" onClick={nearMe} loading={locating}>
                  <CrosshairsIcon className="w-4 h-4" /> Near me
                </Button>
              )}
              <Input label="Available on" type="date" min={today()} value={date} onChange={e => setDate(e.target.value)} hint="Shows pros who work that day." />
            </div>
          </FilterBox>
          <FilterBox title="Starting price">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Minimum" type="number" min={0} inputMode="decimal" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0" />
              <Input label="Maximum" type="number" min={0} inputMode="decimal" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Any" />
            </div>
          </FilterBox>
          <FilterBox title="Rating">
            <div className="space-y-3">
              <Select value={minRating} onChange={e => setMinRating(Number(e.target.value))} aria-label="Minimum rating">
                <option value={0}>Any rating</option>
                <option value={4}>4+ stars</option>
                <option value={3}>3+ stars</option>
              </Select>
              <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label={<span className="text-sm">Verified only</span>} />
            </div>
          </FilterBox>
          {activeFilters > 0 && <Button variant="ghost" block onClick={clear}>Clear all filters</Button>}
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-xl sm:text-2xl font-display" aria-live="polite">
              {data ? <>We found <span className="text-brand-primary">{results.length.toLocaleString()}</span> {results.length === 1 ? 'pro' : 'pros'}{date ? ` working ${formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</> : 'Finding pros…'}
            </h2>
            <label className="flex items-center gap-2 text-sm text-brand-gray">
              Sort by
              <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="font-medium text-brand-dark dark:text-white bg-transparent cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded">
                {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
          </div>

          {visiting.length > 0 && (
            <Card className="mb-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-brand-primary" /> Visiting {city}</h3>
              <ul className="text-sm text-brand-gray space-y-1">
                {visiting.map(a => (
                  <li key={a.id}>
                    <Link to={`/artists/${a.id}`} className="font-semibold text-brand-dark dark:text-white hover:text-brand-primary">{a.name}</Link> at {a.guestSpot!.shopName},{' '}
                    {formatDate(a.guestSpot!.startDate, { month: 'short', day: 'numeric' })} – {formatDate(a.guestSpot!.endDate, { month: 'short', day: 'numeric' })}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {error && <ErrorBox message={error} onRetry={reload} />}
          {loading && !data && <SkeletonGrid count={6} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"><ArtistCardSkeleton /></SkeletonGrid>}
          {data && results.length === 0 && (
            <Card>
              <EmptyState icon={<SearchIcon />} title={data.length === 0 && !date ? 'No pros yet' : 'No pros match your search'}>
                {data.length === 0 && !date ? 'Check back soon. New pros are joining.' : <button className="text-brand-primary" onClick={clear}>Clear filters</button>}
              </EmptyState>
            </Card>
          )}
          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map(a => <ArtistCard key={a.id} artist={a} />)}
            </div>
          )}
          {data && data.length > 0 && !['shop-owner', 'admin'].includes(useStore.getState().user?.role ?? '') && (
            <p className="text-center text-sm text-brand-gray mt-10">
              Do you take bookings?{' '}
              <button
                className="text-brand-primary font-semibold underline"
                onClick={() => {
                  const u = useStore.getState().user;
                  if (!u) useStore.getState().openAuth('register');
                  else navigate(u.role === 'client' ? '/settings#artist' : '/dashboard');
                }}
              >
                List your profile
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
