// Artist directory with search and filters.
import React, { useMemo, useState } from 'react';
import { Link, navigate, useLocation } from '../router';
import { useStore } from '../store';
import { cityFromCoords } from '../lib/maps';
import { formatDate } from '../lib/format';
import { Badge, Button, Card, Cover, EmptyState, ErrorBox, PageHeader, PageLoader, Select, Toggle, inputClass, useApi } from '../components/ui';
import { CalendarIcon, CheckBadgeIcon, CrosshairsIcon, LocationIcon, SearchIcon, SparklesIcon, StarIcon } from '../components/Icons';
import type { PublicArtist } from '../../shared/types';

export const ArtistCard: React.FC<{ artist: PublicArtist }> = ({ artist }) => (
  <Link to={`/artists/${artist.id}`} className="group block rounded-2xl overflow-hidden bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 hover:border-brand-primary/50 hover:-translate-y-1 transition">
    <div className="relative">
      <Cover url={artist.portfolio[0]?.url || artist.avatarUrl} alt={artist.name} className="w-full h-60" />
      <div className="absolute top-2 left-2 right-2 flex justify-between gap-2">
        {artist.averageRating > 0 ? (
          <Badge className="bg-black/60 text-white backdrop-blur"><StarIcon className="w-3.5 h-3.5 text-amber-400" />{artist.averageRating.toFixed(1)}</Badge>
        ) : <span />}
        {artist.isVerified && <Badge className="bg-brand-secondary text-white"><CheckBadgeIcon className="w-3.5 h-3.5" />Verified</Badge>}
      </div>
      {artist.guestSpot && (
        <div className="absolute bottom-2 left-2">
          <Badge className="bg-sky-600 text-white"><CalendarIcon className="w-3.5 h-3.5" />Guest spot in {artist.guestSpot.city}</Badge>
        </div>
      )}
    </div>
    <div className="p-4">
      <h3 className="font-bold text-lg group-hover:text-brand-primary transition-colors flex items-center gap-1.5">
        {artist.name}
        {artist.isPro && <SparklesIcon className="w-4 h-4 text-brand-secondary" title="Pro artist" />}
      </h3>
      {artist.specialty && <p className="text-sm font-semibold text-brand-primary">{artist.specialty}</p>}
      <p className="text-sm text-brand-gray flex items-center gap-1 mt-1"><LocationIcon className="w-4 h-4" />{artist.city || 'Location not set'}</p>
    </div>
  </Link>
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
          else toast("Couldn't work out your city — type it instead.", 'error');
        } catch {
          toast("Couldn't work out your city — type it instead.", 'error');
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
            <input className={`${inputClass} pl-10`} placeholder="Artist name or keyword" value={q} onChange={e => setQ(e.target.value)} aria-label="Search artists" />
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
      {loading && !data && <PageLoader />}
      {data && filtered.length === 0 && (
        <EmptyState icon={<SearchIcon />} title={data.length === 0 ? 'No artists yet' : 'No artists match your search'}>
          {data.length === 0 ? 'Check back soon — new artists are joining.' : <button className="text-brand-primary" onClick={clear}>Clear filters</button>}
        </EmptyState>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(a => <ArtistCard key={a.id} artist={a} />)}
      </div>
      {data && data.length > 0 && (
        <p className="text-center text-sm text-brand-gray mt-10">
          Are you an artist? <button className="text-brand-primary font-semibold" onClick={() => (useStore.getState().user ? navigate('/dashboard') : useStore.getState().openAuth('register'))}>List your profile</button>
        </p>
      )}
    </div>
  );
};
