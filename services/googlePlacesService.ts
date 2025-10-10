// @/services/googlePlacesService.ts
// FIX: Implement the googlePlacesService to provide location autocomplete functionality.

declare global {
  interface Window {
    google: any;
  }
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
