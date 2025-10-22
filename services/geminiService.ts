// @/services/geminiService.ts
// FIX: Changed import from deprecated `GoogleGenerativeAI` to `GoogleGenAI`.
import { GoogleGenAI } from "@google/genai";

const geminiApiKey = import.meta.env.VITE_API_KEY;

if (!geminiApiKey) {
    console.error("Gemini API key (VITE_API_KEY) is missing from .env file. AI features will be disabled.");
}

// Initialize the client, but handle the case where the key might be missing.
// The generateArtistBio function will throw a specific error if the client isn't initialized.
// FIX: Updated client initialization to use a named parameter as required by the new API.
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

/**
 * Generates a professional bio for a tattoo artist using the Gemini API.
 * @param name The artist's name.
 * @param specialty The artist's specialty.
 * @param city The artist's city.
 * @returns A promise that resolves to the generated bio string.
 */
export async function generateArtistBio(name: string, specialty: string, city: string): Promise<string> {
  if (!ai) {
      throw new Error("AI service is not configured. Please check your API key in the .env file.");
  }

  const prompt = `Write a short, professional, and engaging bio for a tattoo artist named ${name}. They specialize in ${specialty} and are based in ${city}. The bio should be around 50-70 words, written in the first person, and highlight their passion and skill. Do not use markdown.`;

  try {
    // FIX: Updated to use the new `ai.models.generateContent` API and a current model.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    // FIX: Updated to access the response text directly via the `.text` property.
    const text = response.text;
    
    // Clean up response, remove potential markdown like quotes
    return text.replace(/^"|"$/g, '').trim();

  } catch (error) {
    console.error("Error generating artist bio with Gemini:", error);
    throw new Error("Failed to generate bio. The AI service may be unavailable or the API key is invalid.");
  }
}
