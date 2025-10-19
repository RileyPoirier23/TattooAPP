// @/services/geminiService.ts

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import type { Artist, Client, Shop } from "../types";

// The API key is sourced from the environment and is assumed to be present.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a creative and professional biography for a tattoo artist.
 * @param name The artist's name.
 * @param specialty The artist's specialty.
 * @returns A promise that resolves to the generated biography string.
 */
export const generateArtistBio = async (name: string, specialty: string): Promise<string> => {
  const prompt = `Generate a short, professional, and creative biography for a tattoo artist named "${name}" who specializes in "${specialty}". The tone should be inspiring and welcoming to potential clients. Make it about 2-3 sentences long.`;
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating artist bio:", error);
    throw new Error("Failed to generate bio with AI. Please try again.");
  }
};

/**
 * Gets a brief summary of a tattoo shop using Google Search grounding for accuracy.
 * @param shopName The name of the shop.
 * @param shopLocation The city/location of the shop.
 * @returns A promise that resolves to an object containing the summary text and grounding chunks.
 */
export const getShopInfo = async (shopName: string, shopLocation: string): Promise<{ text: string; chunks: any[] }> => {
  const prompt = `Provide a brief, interesting summary about the tattoo shop "${shopName}" located in "${shopLocation}". Mention its reputation, notable styles, or any unique facts. Keep it to 2-3 sentences.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return { text, chunks };
  } catch (error) {
    console.error("Error generating shop info with Google Search:", error);
    throw new Error("Failed to get AI-powered insights. The service may be temporarily unavailable.");
  }
};

/**
 * Fetches an image from a URL and converts it to a base64 string.
 * @param url The URL of the image to fetch.
 * @returns A promise that resolves to the base64 string and its MIME type.
 */
const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    // Use a proxy to bypass potential CORS issues if needed, though Supabase public URLs are generally fine.
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    const mimeType = blob.type;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            // result is a data URL (e.g., "data:image/jpeg;base64,..."), we only need the base64 part.
            const base64 = (reader.result as string).split(',')[1];
            resolve({ base64, mimeType });
        };
        reader.readAsDataURL(blob);
    });
};


/**
 * Edits an image using Gemini based on a text prompt.
 * @param imageUrl The public URL of the image to edit.
 * @param prompt The text prompt describing the desired edits.
 * @returns A promise that resolves to the base64 string of the edited image.
 */
export const editImageWithGemini = async (imageUrl: string, prompt: string): Promise<string> => {
    try {
        const { base64, mimeType } = await urlToBase64(imageUrl);

        const imagePart = {
            inlineData: {
                data: base64,
                mimeType: mimeType,
            },
        };
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        const firstPart = response.candidates?.[0]?.content?.parts?.[0];
        if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
            return firstPart.inlineData.data;
        }

        throw new Error("No image data was returned from the AI. The request may have been filtered.");

    } catch (error) {
        console.error("Error editing image with Gemini:", error);
        throw new Error("Failed to edit image with AI. The service might be busy or the content was filtered.");
    }
};

// --- Function Overloading for Type Safety ---

/**
 * Generates personalized recommendations for artists looking for shops.
 * @param type Must be 'shop'.
 * @param items The full list of shops to choose from.
 * @param user The artist for whom to generate recommendations.
 * @returns A promise that resolves to an array of recommended shop IDs.
 */
export function getRecommendations(type: 'shop', items: Shop[], user: Artist): Promise<string[]>;
/**
 * Generates personalized recommendations for clients looking for artists.
 * @param type Must be 'artist'.
 * @param items The full list of artists to choose from.
 * @param user The client or artist (acting as a client) for whom to generate recommendations.
 * @returns A promise that resolves to an array of recommended artist IDs.
 */
export function getRecommendations(type: 'artist', items: Artist[], user: Artist | Client): Promise<string[]>;

/**
 * Generates personalized recommendations for artists or clients using AI.
 * This is the implementation function and should not be called directly.
 */
export async function getRecommendations(
    type: 'artist' | 'shop',
    items: (Artist | Shop)[],
    user: Artist | Client
): Promise<string[]> {
    
    let prompt = '';

    if (type === 'shop') {
        // FIX: Add a type guard. The function overloads ensure `user` is an `Artist` when `type` is 'shop',
        // but we must check this within the implementation to narrow the type for TypeScript and safely access artist-specific properties.
        if (!('specialty' in user)) {
            // This path should not be hit in a type-safe application.
            throw new Error("getRecommendations was called with type 'shop' but the user provided was not an artist.");
        }
        const artist = user; // `user` is now correctly narrowed to `Artist`
        const shopsForPrompt = (items as Shop[]).map(s => ({ id: s.id, name: s.name, location: s.location, amenities: s.amenities, averageArtistRating: s.averageArtistRating, isVerified: s.isVerified }));
        prompt = `You are a recommendation engine for a tattoo marketplace. An artist named ${artist.name} in ${artist.city} who specializes in "${artist.specialty}" is looking for a shop. Based on the following list of shops, recommend the top 3. Prioritize verified shops with high ratings and relevant amenities.
        Available shops: ${JSON.stringify(shopsForPrompt)}`;
    } else {
        // FIX: Safely check for the 'city' property, as a 'Client' type does not have it.
        const userCity = 'city' in user ? user.city : 'their area';
        const artistsForPrompt = (items as Artist[]).map(a => ({ id: a.id, name: a.name, city: a.city, specialty: a.specialty, averageRating: a.averageRating, isVerified: a.isVerified }));
        prompt = `You are a recommendation engine for a tattoo marketplace. A client is looking for an artist in ${userCity}. Based on the following list of artists, recommend the top 3. Prioritize verified artists with high ratings who are in the client's city.
        Available artists: ${JSON.stringify(artistsForPrompt)}`;
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recommendedIds: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            }
                        }
                    },
                    required: ['recommendedIds']
                }
            }
        });
        
        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        return result.recommendedIds || [];
    } catch (error) {
        console.error("Error generating recommendations:", error);
        throw new Error("Failed to generate recommendations with AI.");
    }
};