// Shop directory for artists looking for guest spots, plus optional unclaimed Google listings.
import React, { useMemo, useState } from 'react';
import { Link } from '../router';
import { useStore } from '../store';
import { dollars } from '../lib/format';
import { findTattooShops, type UnclaimedShop } from '../lib/maps';
import { Badge, Button, Card, Cover, EmptyState, ErrorBox, PageHeader, PageLoader, Toggle, inputClass, useApi } from '../components/ui';
import { CheckBadgeIcon, LocationIcon, SearchIcon, StarIcon, StoreIcon } from '../components/Icons';
import type { Shop } from '../../shared/types';

export const ShopCard: React.FC<{ shop: Shop }> = ({ shop }) => {
  const minRate = shop.booths.length ? Math.min(...shop.booths.map(b => b.dailyRate)) : null;
  return (
    <Link to={`/shops/${shop.id}`} className="group block rounded-2xl overflow-hidden bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 hover:border-brand-primary/50 hover:-translate-y-1 transition">
      <div className="relative">
        <Cover url={shop.imageUrl} alt={shop.name} className="w-full h-48" />
        {shop.isVerified && (
          <Badge className="absolute top-2 right-2 bg-brand-secondary-solid text-on-secondary"><CheckBadgeIcon className="w-3.5 h-3.5" />Verified</Badge>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between gap-2">
          <h3 className="font-bold text-lg group-hover:text-brand-primary transition-colors">{shop.name}</h3>
          {shop.reviewCount > 0 && (
            <span className="flex items-center gap-1 text-sm font-semibold"><StarIcon className="w-4 h-4 text-amber-400" />{shop.averageRating.toFixed(1)}</span>
          )}
        </div>
        <p className="text-sm text-brand-gray flex items-center gap-1 mt-0.5"><LocationIcon className="w-4 h-4" />{shop.city}</p>
        <div className="flex items-center justify-between mt-3">
          <div className="flex flex-wrap gap-1">
            {shop.amenities.slice(0, 3).map(a => <Badge key={a} tone="brand">{a}</Badge>)}
          </div>
          {minRate !== null && <span className="text-sm whitespace-nowrap"><strong>{dollars(minRate)}</strong><span className="text-brand-gray">/day</span></span>}
        </div>
      </div>
    </Link>
  );
};

const UnclaimedCard: React.FC<{ shop: UnclaimedShop }> = ({ shop }) => (
  <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900/60 border border-dashed border-gray-300 dark:border-gray-700 opacity-80">
    <Cover url={shop.photoUrl} alt={shop.name} className="w-full h-40 grayscale" />
    <div className="p-4">
      <h3 className="font-bold">{shop.name}</h3>
      <p className="text-xs text-brand-gray mt-0.5">{shop.address}</p>
      <div className="flex items-center justify-between mt-3">
        <Badge tone="gray">Not on the platform yet</Badge>
        {shop.mapsUrl && <a href={shop.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary hover:underline">View on Maps</a>}
      </div>
    </div>
  </div>
);

export const ShopsPage: React.FC = () => {
  const settings = useStore(s => s.config!.settings);
  const user = useStore(s => s.user);
  const openAuth = useStore(s => s.openAuth);
  const { data, error, loading, reload } = useApi<Shop[]>('/shops');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [amenity, setAmenity] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [unclaimed, setUnclaimed] = useState<UnclaimedShop[]>([]);
  const [searchingGoogle, setSearchingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const amenities = useMemo(() => Array.from(new Set((data || []).flatMap(s => s.amenities))).sort(), [data]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const c = city.trim().toLowerCase();
    return (data || []).filter(s =>
      (!term || s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term)) &&
      (!c || s.city.toLowerCase().includes(c) || s.address.toLowerCase().includes(c)) &&
      (!amenity || s.amenities.includes(amenity)) &&
      (!verifiedOnly || s.isVerified),
    );
  }, [data, q, city, amenity, verifiedOnly]);

  const showUnclaimed = settings.features.unclaimedShops && !!settings.googleMapsApiKey;
  const searchGoogle = async () => {
    if (!city.trim()) return;
    setSearchingGoogle(true);
    setGoogleError('');
    try {
      const results = await findTattooShops(settings.googleMapsApiKey, city.trim());
      const known = new Set((data || []).map(s => s.name.toLowerCase()));
      setUnclaimed(results.filter(r => !known.has(r.name.toLowerCase())));
    } catch {
      setGoogleError("Couldn't search Google Maps right now.");
    } finally {
      setSearchingGoogle(false);
    }
  };

  return (
    <div>
      <PageHeader title="Guest spots & booths" subtitle="Find a shop in your next city and rent a booth for a day, a week or longer." />
      <Card className="mb-8">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
            <input className={`${inputClass} pl-10`} placeholder="Shop name" value={q} onChange={e => setQ(e.target.value)} aria-label="Shop name" />
          </div>
          <form
            className="relative"
            onSubmit={e => {
              e.preventDefault();
              if (showUnclaimed) searchGoogle();
            }}
          >
            <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
            <input className={`${inputClass} pl-10`} placeholder="City" value={city} onChange={e => { setCity(e.target.value); setUnclaimed([]); }} aria-label="City" />
          </form>
          <select className={inputClass} value={amenity} onChange={e => setAmenity(e.target.value)} aria-label="Amenity">
            <option value="">Any amenities</option>
            {amenities.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label={<span className="text-sm">Verified only</span>} />
          {showUnclaimed && city.trim() && (
            <Button size="sm" variant="outline" onClick={searchGoogle} loading={searchingGoogle}>Also search Google Maps</Button>
          )}
          <span className="ml-auto text-sm text-brand-gray">{filtered.length} shop{filtered.length === 1 ? '' : 's'}</span>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <PageLoader />}
      {data && filtered.length === 0 && (
        <EmptyState icon={<StoreIcon />} title={data.length === 0 ? 'No shops listed yet' : 'No shops match your search'}>
          {user?.role === 'shop-owner' ? <Link to="/shop" className="text-brand-primary">List your shop</Link> : !user && <button className="text-brand-primary" onClick={() => openAuth('register')}>Own a shop? List it for free</button>}
        </EmptyState>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(s => <ShopCard key={s.id} shop={s} />)}
      </div>

      {googleError && <p className="text-sm text-red-600 dark:text-red-400 mt-6">{googleError}</p>}
      {unclaimed.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-1">Other shops in {city}</h2>
          <p className="text-sm text-brand-gray mb-4">These shops aren't on the platform yet. Shop owners can sign up to list their booths.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {unclaimed.map(s => <UnclaimedCard key={s.id} shop={s} />)}
          </div>
        </section>
      )}
    </div>
  );
};
