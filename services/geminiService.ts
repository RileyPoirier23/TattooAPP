// @/services/geminiService.ts

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// The API key is sourced from the environment and is assumed to be present.
// For Vite projects, environment variables must be accessed via `import.meta.env`.
// FIX: Cast `import.meta` to `any` to resolve TypeScript error regarding the 'env' property.
const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_API_KEY });

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
