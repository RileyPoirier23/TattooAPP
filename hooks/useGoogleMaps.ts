
// @/hooks/useGoogleMaps.ts

import { useState, useEffect } from 'react';

declare global {
    interface Window {
        google?: any;
        gm_authFailure?: () => void;
        inkspaceGoogleMapsLoaded?: () => void;
    }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_MAPS_API_KEY || '';
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script';

let isMapsApiAttached = false;

export const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if Google Maps is already loaded globally
    if (window.google?.maps) {
        setIsLoaded(true);
        return;
    }

    if (isLoaded || isMapsApiAttached) return;
    
    isMapsApiAttached = true;

    if (!GOOGLE_MAPS_API_KEY) {
      const errorMsg = "Configuration Issue: VITE_MAPS_API_KEY is missing in .env file.";
      console.error(errorMsg);
      setError(new Error(errorMsg));
      return;
    }

    window.gm_authFailure = () => {
      const errorMsg = "Google Maps Authentication Failed: Invalid API key.";
      console.error(errorMsg);
      setError(new Error(errorMsg));
    };

    window.inkspaceGoogleMapsLoaded = () => {
      setIsLoaded(true);
    };

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=inkspaceGoogleMapsLoaded`;
    script.async = true;
    script.defer = true;

    script.onerror = (e) => {
      const errorMsg = "Network Error: Could not load Google Maps script.";
      console.error(errorMsg, e);
      setError(new Error(errorMsg));
    };

    document.head.appendChild(script);

  }, [isLoaded]);

  return { isLoaded, error };
};
