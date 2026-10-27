// Shop directory for artists looking for guest spots, plus optional unclaimed Google listings.
import React, { useMemo, useState } from 'react';
import { Link } from '../router';
import { useStore } from '../store';
import { dollars } from '../lib/format';
import { findTattooShops, type UnclaimedShop } from '../lib/maps';
import { Badge, Button, Card, Cover, EmptyState, ErrorBox, PageHeader, Skeleton, SkeletonGrid, Toggle, catalogCell, catalogGrid, catalogNo, cx, inputClass, useApi } from '../components/ui';
import { CheckBadgeIcon, LocationIcon, SearchIcon, StarIcon, StoreIcon } from '../components/Icons';
import type { Shop } from '../../shared/types';

export const ShopCard: React.FC<{ shop: Shop; index?: number }> = ({ shop, index }) => {
  const minRate = shop.booths.length ? Math.min(...shop.booths.map(b => b.dailyRate)) : null;
  return (
    <Link to={`/shops/${shop.id}`} className={cx('group flex flex-col bg-brand-light dark:bg-brand-dark', catalogCell)}>
      <div className="relative aspect-[16/10] overflow-hidden">
        <Cover url={shop.imageUrl} alt={shop.name} className="w-full h-full transition-transform duration-500 ease-out-strong motion-safe:group-hover:scale-[1.04]" />
        {shop.isVerified && (
          <Badge tone="none" className="absolute top-0 right-0 bg-brand-dark text-brand-light"><CheckBadgeIcon className="w-3 h-3" />Verified</Badge>
        )}
      </div>
      <div className="flex-1 border-t border-gray-900 dark:border-gray-700 p-4 transition-colors duration-150 group-hover:bg-brand-dark group-hover:text-brand-light dark:group-hover:bg-white dark:group-hover:text-brand-dark">
        <div className="label flex justify-between gap-3 text-brand-gray group-hover:text-inherit">
          <span className="truncate">{shop.city}</span>
          {index !== undefined && <span className="flex-shrink-0">{catalogNo(index)}</span>}
        </div>
        <h3 className="font-display text-3xl mt-2">{shop.name}</h3>
        <div className="flex items-end justify-between gap-3 mt-3">
          <p className="label text-brand-gray group-hover:text-inherit min-w-0 truncate" title={shop.amenities.join(', ')}>{shop.amenities.slice(0, 3).join(' / ')}</p>
          <div className="flex-shrink-0 text-right">
            {shop.reviewCount > 0 && <p className="text-sm flex items-center justify-end gap-1"><StarIcon className="w-3.5 h-3.5 text-amber-400" />{shop.averageRating.toFixed(1)}</p>}
            {minRate !== null && <p className="text-sm whitespace-nowrap"><span className="label text-brand-gray group-hover:text-inherit">From </span><strong>{dollars(minRate)}</strong>/day</p>}
          </div>
        </div>
      </div>
    </Link>
  );
};

const ShopCardSkeleton: React.FC = () => (
  <div className={cx('flex flex-col', catalogCell)}>
    <Skeleton className="aspect-[16/10]" />
    <div className="border-t border-gray-900 dark:border-gray-700 p-4 space-y-2">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  </div>
);

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
      {loading && !data && <SkeletonGrid count={6} className={cx(catalogGrid, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}><ShopCardSkeleton /></SkeletonGrid>}
      {data && filtered.length === 0 && (
        <EmptyState icon={<StoreIcon />} title={data.length === 0 ? 'No shops listed yet' : 'No shops match your search'}>
          {user?.role === 'shop-owner' ? <Link to="/shop" className="text-brand-primary">List your shop</Link> : !user && <button className="text-brand-primary" onClick={() => openAuth('register')}>Own a shop? List it for free</button>}
        </EmptyState>
      )}
      {filtered.length > 0 && (
        <div className={cx(catalogGrid, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
          {filtered.map((s, i) => <ShopCard key={s.id} shop={s} index={i} />)}
        </div>
      )}

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
