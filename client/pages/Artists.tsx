// Artist directory with search and filters.
import React, { useMemo, useState } from 'react';
import { Link, navigate, useLocation } from '../router';
import { useStore } from '../store';
import { cityFromCoords } from '../lib/maps';
import { dollars, formatDate } from '../lib/format';
import { Avatar, Badge, Button, Card, Cover, EmptyState, ErrorBox, PageHeader, Select, Skeleton, SkeletonGrid, Toggle, inputClass, useApi } from '../components/ui';
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
          <span className="truncate">{artist.specialty || 'Tattoo artist'}</span>
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

export const ArtistsPage: React.FC = () => {
  const settings = useStore(s => s.config!.settings);
  const toast = useStore(s => s.toast);
  const { query } = useLocation();
  const { data, error, loading, reload } = useApi<PublicArtist[]>('/artists');
  const [q, setQ] = useState(query.get('q') || '');
  const [city, setCity] = useState(query.get('city') || '');
  const [style, setStyle] = useState(query.get('style') || '');
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [locating, setLocating] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const c = city.trim().toLowerCase();
    return (data || []).filter(a =>
      (!term || a.name.toLowerCase().includes(term) || a.bio.toLowerCase().includes(term) || a.specialty.toLowerCase().includes(term)) &&
      (!c || a.city.toLowerCase().includes(c) || a.guestSpot?.city.toLowerCase().includes(c)) &&
      (!style || a.specialty.toLowerCase().includes(style.toLowerCase())) &&
      a.averageRating >= minRating &&
      (!verifiedOnly || a.isVerified),
    );
  }, [data, q, city, style, minRating, verifiedOnly]);

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

  const clear = () => {
    setQ('');
    setCity('');
    setStyle('');
    setMinRating(0);
    setVerifiedOnly(false);
  };

  const guestSpotsHere = city ? filtered.filter(a => a.guestSpot?.city.toLowerCase().includes(city.toLowerCase())) : [];

  return (
    <div>
      <PageHeader title="Find an artist" subtitle="Browse portfolios, read reviews and request a booking." />
      <Card className="mb-8">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
            <input type="search" enterKeyHint="search" className={`${inputClass} pl-10`} placeholder="Artist name or keyword" value={q} onChange={e => setQ(e.target.value)} aria-label="Search artists" />
          </div>
          <div className="relative">
            <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
            <input className={`${inputClass} pl-10`} placeholder="City" value={city} onChange={e => setCity(e.target.value)} aria-label="City" />
          </div>
          <Select value={style} onChange={e => setStyle(e.target.value)} aria-label="Style">
            <option value="">All styles</option>
            {settings.specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={minRating} onChange={e => setMinRating(Number(e.target.value))} aria-label="Minimum rating">
            <option value={0}>Any rating</option>
            <option value={4}>4+ stars</option>
            <option value={3}>3+ stars</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {settings.googleMapsApiKey && (
            <Button variant="secondary" size="sm" onClick={nearMe} loading={locating}>
              <CrosshairsIcon className="w-4 h-4" /> Near me
            </Button>
          )}
          <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label={<span className="text-sm">Verified only</span>} />
          <button onClick={clear} className="text-sm text-brand-gray hover:text-brand-primary">Clear filters</button>
          <span className="ml-auto text-sm text-brand-gray">{filtered.length} artist{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </Card>

      {guestSpotsHere.length > 0 && (
        <Card className="mb-8 border-sky-500/40">
          <h2 className="font-bold mb-2 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-sky-500" /> Guest artists visiting {city}</h2>
          <ul className="text-sm text-brand-gray space-y-1">
            {guestSpotsHere.map(a => (
              <li key={a.id}>
                <Link to={`/artists/${a.id}`} className="font-semibold text-brand-dark dark:text-white hover:text-brand-primary">{a.name}</Link> at {a.guestSpot!.shopName},{' '}
                {formatDate(a.guestSpot!.startDate, { month: 'short', day: 'numeric' })} – {formatDate(a.guestSpot!.endDate, { month: 'short', day: 'numeric' })}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <SkeletonGrid count={8} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"><ArtistCardSkeleton /></SkeletonGrid>}
      {data && filtered.length === 0 && (
        <EmptyState icon={<SearchIcon />} title={data.length === 0 ? 'No artists yet' : 'No artists match your search'}>
          {data.length === 0 ? 'Check back soon. New artists are joining.' : <button className="text-brand-primary" onClick={clear}>Clear filters</button>}
        </EmptyState>
      )}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(a => <ArtistCard key={a.id} artist={a} />)}
        </div>
      )}
      {data && data.length > 0 && !['shop-owner', 'admin'].includes(useStore.getState().user?.role ?? '') && (
        <p className="text-center text-sm text-brand-gray mt-10">
          Are you an artist?{' '}
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
  );
};
