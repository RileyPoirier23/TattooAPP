// Google Maps loader (optional — only used when an API key is set in Admin → Settings).
declare global {
  interface Window {
    google?: any;
    __inkspaceMapsReady?: () => void;
  }
}

let promise: Promise<any> | null = null;

export function loadMaps(apiKey: string): Promise<any> {
  if (!apiKey) return Promise.reject(new Error('Maps are not configured.'));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    window.__inkspaceMapsReady = () => resolve(window.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=__inkspaceMapsReady`;
    s.async = true;
    s.onerror = () => {
      promise = null;
      reject(new Error('Could not load Google Maps.'));
    };
    document.head.appendChild(s);
  });
  return promise;
}

/** Converts an address into coordinates. */
export async function geocode(apiKey: string, address: string): Promise<{ lat: number; lng: number } | null> {
  const google = await loadMaps(apiKey);
  const geocoder = new google.maps.Geocoder();
  return new Promise(resolve => {
    geocoder.geocode({ address }, (results: any[], status: string) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else resolve(null);
    });
  });
}

/** Finds the city name for coordinates (used by "Near me"). */
export async function cityFromCoords(apiKey: string, lat: number, lng: number): Promise<string | null> {
  const google = await loadMaps(apiKey);
  const geocoder = new google.maps.Geocoder();
  return new Promise(resolve => {
    geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      if (status !== 'OK' || !results?.[0]) return resolve(null);
      const city = results[0].address_components.find((c: any) => c.types.includes('locality'));
      resolve(city?.long_name ?? null);
    });
  });
}

export interface UnclaimedShop {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  photoUrl: string | null;
  mapsUrl: string | null;
}

/** Looks up tattoo shops in a city on Google Maps (shown as "unclaimed" listings). */
export async function findTattooShops(apiKey: string, city: string): Promise<UnclaimedShop[]> {
  const google = await loadMaps(apiKey);
  const { Place } = await google.maps.importLibrary('places');
  const { places } = await Place.searchByText({
    textQuery: `tattoo shops in ${city}`,
    fields: ['id', 'displayName', 'formattedAddress', 'rating', 'photos', 'googleMapsURI'],
    maxResultCount: 12,
  });
  return (places || []).map((p: any) => ({
    id: p.id,
    name: p.displayName,
    address: p.formattedAddress,
    rating: p.rating ?? null,
    photoUrl: p.photos?.[0]?.getURI({ maxWidth: 600 }) ?? null,
    mapsUrl: p.googleMapsURI ?? null,
  }));
}
