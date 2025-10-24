// @/components/shared/MapEmbed.tsx

import React, { useEffect, useRef } from 'react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { Loader } from './Loader';

interface MapEmbedProps {
  lat: number;
  lng: number;
  zoom?: number;
}

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];


export const MapEmbed: React.FC<MapEmbedProps> = ({ lat, lng, zoom = 15 }) => {
  const { isLoaded, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoaded && mapRef.current && window.google) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom,
        disableDefaultUI: true,
        styles: mapStyles,
      });
      new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#F04E98',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
        }
      });
    }
  }, [isLoaded, lat, lng, zoom]);

  if (error) {
    return <div className="w-full h-64 bg-gray-800 flex items-center justify-center rounded-lg p-4 text-center"><p className="text-brand-gray text-sm">{error.message}</p></div>;
  }

  if (!isLoaded) {
    return <div className="w-full h-64 bg-gray-800 flex items-center justify-center rounded-lg"><Loader /></div>;
  }

  return <div ref={mapRef} className="w-full h-64 rounded-lg" aria-label="Map showing shop location" />;
};
