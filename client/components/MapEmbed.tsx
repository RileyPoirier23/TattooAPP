// Shows a map pin for a shop when a Google Maps key is configured; otherwise a "Open in Maps" link.
import React, { useEffect, useRef, useState } from 'react';
import { loadMaps } from '../lib/maps';
import { useStore } from '../store';
import { LocationIcon } from './Icons';

export const MapEmbed: React.FC<{ lat: number | null; lng: number | null; address: string }> = ({ lat, lng, address }) => {
  const apiKey = useStore(s => s.config!.settings.googleMapsApiKey);
  const theme = useStore(s => s.theme);
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat != null && lng != null ? `${lat},${lng}` : address)}`;

  useEffect(() => {
    if (!apiKey || lat == null || lng == null) return;
    let cancelled = false;
    loadMaps(apiKey)
      .then(google => {
        if (cancelled || !ref.current) return;
        const map = new google.maps.Map(ref.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          colorScheme: theme === 'dark' ? 'DARK' : 'LIGHT',
        });
        new google.maps.Marker({ position: { lat, lng }, map });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [apiKey, lat, lng, theme]);

  if (!apiKey || lat == null || lng == null || failed) {
    return (
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline">
        <LocationIcon className="w-5 h-5" /> Open in Google Maps
      </a>
    );
  }
  return (
    <div>
      <div ref={ref} className="w-full h-64 rounded-xl bg-gray-200 dark:bg-gray-800" aria-label="Map" />
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-brand-primary hover:underline">Get directions</a>
    </div>
  );
};
