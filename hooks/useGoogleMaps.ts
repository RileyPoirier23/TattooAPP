// @/hooks/useGoogleMaps.ts

import { useState, useEffect } from 'react';

// FIX: Add global declarations for Google Maps callbacks to inform TypeScript that these properties will be available at runtime.
declare global {
  interface Window {
    google: any;
    inkspaceGoogleMapsLoaded: () => void;
    gm_authFailure: () => void;
  }
}

// FIX: Cast `import.meta` to `any` to resolve TypeScript error regarding the 'env' property.
const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_MAPS_API_KEY;
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script';

// This ensures callbacks and the script are only attached once, even if the hook is used in multiple components.
let isMapsApiAttached = false;

export const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(window.google?.maps ? true : false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If the API is already loaded or the script has been attached, don't do anything.
    if (isLoaded || isMapsApiAttached) {
      return;
    }
    
    isMapsApiAttached = true; // Set flag to prevent re-attachment on subsequent hook mounts.

    // If no API key, set a clear, developer-focused error and stop.
    if (!GOOGLE_MAPS_API_KEY) {
      const errorMsg = "Configuration Issue: The Google Maps API key is missing. Please add `VITE_MAPS_API_KEY` to your environment file. Location features will be disabled.";
      console.error(errorMsg);
      setError(new Error(errorMsg));
      return;
    }

    // This is the official Google Maps callback for authentication failures (e.g., bad API key).
    window.gm_authFailure = () => {
      const errorMsg = "Google Maps Authentication Failed: The provided API key is invalid, expired, or has incorrect restrictions. Please check your Google Cloud Console settings. Location features are disabled.";
      console.error(errorMsg);
      setError(new Error(errorMsg));
    };

    // This callback is triggered by the script URL when it loads successfully.
    window.inkspaceGoogleMapsLoaded = () => {
      setIsLoaded(true);
    };

    // Create and append the script element.
    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    // Add libraries=places and the callback parameter for robust loading.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=inkspaceGoogleMapsLoaded`;
    script.async = true;
    script.defer = true;

    script.onerror = (e) => {
      // This handles general network errors, script blocking by extensions, etc.
      const errorMsg = "Could not load the Google Maps script. This might be due to a network issue, ad-blocker, or Content Security Policy. Please check your network connection and browser console for more details.";
      console.error(errorMsg, e);
      setError(new Error(errorMsg));
    };

    document.head.appendChild(script);

  }, [isLoaded]); // Depend on isLoaded to ensure effect logic doesn't re-run unnecessarily.

  return { isLoaded, error };
};
