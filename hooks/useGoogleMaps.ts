// @/hooks/useGoogleMaps.ts

import { useState, useEffect } from 'react';

// FIX: Add a global declaration for window.google to inform TypeScript that this property will be available at runtime.
declare global {
  interface Window {
    google: any;
  }
}

// FIX: Cast `import.meta` to `any` to resolve TypeScript error regarding the 'env' property.
const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_MAPS_API_KEY; 
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script';

export const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if script is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already in the DOM but not loaded
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      const handleLoad = () => setIsLoaded(true);
      const handleError = (e: Event | string) => setError(new Error(e instanceof Event ? 'Failed to load Google Maps script' : String(e)));
      
      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', handleError);
      
      return () => {
        existingScript.removeEventListener('load', handleLoad);
        existingScript.removeEventListener('error', handleError);
      };
    }

    // If no API key, don't attempt to load
    if (!GOOGLE_MAPS_API_KEY) {
        const warning = "Google Maps API key is not configured. Map will not be loaded.";
        console.warn(warning);
        setError(new Error(warning));
        return;
    }
    
    // Create and append the script
    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsLoaded(true);
    };
    script.onerror = (e) => {
      setError(new Error(e instanceof Event ? 'Failed to load Google Maps script' : e.toString()));
      if(script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    document.body.appendChild(script);

  }, []);

  return { isLoaded, error };
};
