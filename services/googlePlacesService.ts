// @/services/googlePlacesService.ts
// Implemented the googlePlacesService to provide location autocomplete functionality.

import type { Shop } from '../types';

declare global {
    interface Window {
        google?: any;
    }
}

const getPlacesService = () => {
    if (window.google?.maps?.places?.PlacesService) {
        // The service needs a DOM element to attach to, but it doesn't have to be visible.
        return new window.google.maps.places.PlacesService(document.createElement('div'));
    }
    return null;
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
        geocoder.geocode({ location: coords }, (results: any[], status: string) => {
            if (status === 'OK') {
                if (results[0]) {
                    for (const component of results[0].address_components) {
                        if (component.types.includes('locality')) {
                            resolve(component.long_name);
                            return;
                        }
                    }
                    reject(new Error("City not found in geocode result."));
                } else {
                    reject(new Error("No results found."));
                }
            } else {
                reject(new Error(`Geocoder failed due to: ${status}`));
            }
        });
    });
};

/**
 * Searches for tattoo shops in a given area using Google Places text search.
 * @param query The search query (e.g., "New York").
 * @returns A promise that resolves to an array of partial Shop objects.
 */
export const findTattooShops = (query: string): Promise<Partial<Shop>[]> => {
    const service = getPlacesService();
    if (!service) {
        return Promise.reject(new Error("Places service is not available."));
    }

    return new Promise((resolve, reject) => {
        const request = {
            query: `tattoo shops in ${query}`,
            fields: ['name', 'formatted_address', 'geometry', 'photos', 'place_id'],
        };
        
        service.textSearch(request, (results: any[], status: string) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                const shops: Partial<Shop>[] = results.map(place => ({
                    id: `gplace-${place.place_id}`,
                    name: place.name,
                    address: place.formatted_address,
                    location: query,
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    imageUrl: place.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 400 }) || `https://ui-avatars.com/api/?name=${encodeURIComponent(place.name)}&background=1A1A1D&color=F04E98`,
                    isVerified: false, // These are unverified listings by default
                    averageArtistRating: 0, // No rating data from Places API in this context
                }));
                resolve(shops);
            } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
            } else {
                reject(new Error(`Places search failed with status: ${status}`));
            }
        });
    });
};
