// @/services/googlePlacesService.ts
// FIX: Implement the googlePlacesService to provide location autocomplete functionality.

import type { Shop } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

let placesService: any;

const getPlacesService = () => {
    if (!placesService && window.google?.maps?.places?.PlacesService) {
        // The service needs a DOM element to attach to, but it doesn't have to be visible.
        placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
    }
    return placesService;
}

/**
 * Gets the Google Maps Places Autocomplete service instance if available.
 * @returns The service instance or null.
 */
const getAutocompleteService = () => {
    if (window.google?.maps?.places?.AutocompleteService) {
        return new window.google.maps.places.AutocompleteService();
    }
    console.warn("Google Maps Places AutocompleteService not available. Ensure the Maps script is loaded.");
    return null;
}

/**
 * Gets the Google Maps Geocoder service instance if available.
 * @returns The service instance or null.
 */
const getGeocoderService = () => {
    if (window.google?.maps?.Geocoder) {
        return new window.google.maps.Geocoder();
    }
    console.warn("Google Maps Geocoder not available. Ensure the Maps script is loaded.");
    return null;
}


/**
 * Fetches place autocomplete predictions based on user input.
 * @param input The search string from the user.
 * @returns A promise that resolves to an array of prediction objects.
 */
export const getPlacePredictions = (input: string): Promise<any[]> => {
    const service = getAutocompleteService();
    if (!service || !input) {
        return Promise.resolve([]);
    }
    
    return new Promise((resolve) => {
        service.getPlacePredictions(
            { 
                input,
                // Bias search results towards cities
                types: ['(cities)']
            }, 
            (predictions: any[] | null, status: string) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    resolve(predictions);
                } else {
                    // Resolve with an empty array for other statuses like ZERO_RESULTS
                    resolve([]);
                }
            }
        );
    });
};

/**
 * Fetches the city name from latitude and longitude coordinates.
 * @param coords The latitude and longitude.
 * @returns A promise that resolves to the city name string.
 */
export const getCityFromCoords = (coords: { lat: number; lng: number }): Promise<string> => {
    const geocoder = getGeocoderService();
    if (!geocoder) {
        return Promise.reject(new Error("Geocoder service not available."));
    }

    return new Promise((resolve, reject) => {
        geocoder.geocode({ location: coords }, (results: any[] | null, status: string) => {
            if (status === 'OK' && results) {
                // Find the result that is a locality (city)
                const cityResult = results.find(result => result.types.includes('locality'));
                if (cityResult) {
                    // Find the address component that is the city name
                    const cityComponent = cityResult.address_components.find(
                        (component: any) => component.types.includes('locality')
                    );
                    if (cityComponent) {
                        resolve(cityComponent.long_name);
                        return;
                    }
                }
                // Fallback to the first result's formatted address if no locality found
                if (results[0]?.formatted_address) {
                     // try to parse city from it
                     const addressParts = results[0].formatted_address.split(',');
                     if (addressParts.length >= 3) {
                         resolve(addressParts[addressParts.length - 3].trim());
                         return;
                     }
                }
                reject(new Error("Could not find a city for the provided coordinates."));
            } else {
                reject(new Error(`Geocoding failed due to: ${status}`));
            }
        });
    });
};


/**
 * Finds tattoo shops in a given location using Google Places API.
 * @param query The city or location to search in.
 * @returns A promise that resolves to an array of Shop-like objects.
 */
export const findTattooShops = (query: string): Promise<Partial<Shop>[]> => {
    const service = getPlacesService();
    if (!service || !query) {
        return Promise.resolve([]);
    }

    const request = {
        query: `tattoo shop in ${query}`,
        fields: ['name', 'formatted_address', 'geometry', 'rating', 'place_id', 'photos'],
    };

    return new Promise((resolve) => {
        service.textSearch(request, (results: any[] | null, status: string) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                const unverifiedShops: Partial<Shop>[] = results.map(place => ({
                    id: place.place_id,
                    name: place.name,
                    location: query, // Use the query as location for consistency
                    address: place.formatted_address,
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    rating: place.rating || 0,
                    imageUrl: place.photos?.[0]?.getUrl() || `https://ui-avatars.com/api/?name=${place.name.replace(' ', '+')}&background=1A1A1D&color=F04E98`,
                    isVerified: false,
                    amenities: [], // Not available from basic search
                    reviews: [], // Not available from basic search
                }));
                resolve(unverifiedShops);
            } else {
                 if (status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    console.error('Google Places search failed with status:', status);
                 }
                resolve([]);
            }
        });
    });
};
