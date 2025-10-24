// @/services/geminiService.ts
import { GoogleGenAI } from "@google/genai";

// The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.
const geminiApiKey = process.env.API_KEY;

let genAI: GoogleGenAI | null = null;
if (!geminiApiKey) {
    console.error("Gemini API key (API_KEY) is missing from environment variables. AI features will be disabled.");
} else {
    genAI = new GoogleGenAI({ apiKey: geminiApiKey });
}


/**
 * Generates a professional bio for a tattoo artist using the Gemini API.
 * @param name The artist's name.
 * @param specialty The artist's specialty.
 * @param city The artist's city.
 * @returns A promise that resolves to the generated bio string.
 */
export async function generateArtistBio(name: string, specialty: string, city: string): Promise<string> {
  if (!genAI) {
      throw new Error("AI service is not configured. Please check your API key in the environment variables.");
  }

  const model = "gemini-2.5-flash";
  const prompt = `Write a short, professional, and engaging bio for a tattoo artist named ${name}. They specialize in ${specialty} and are based in ${city}. The bio should be around 50-70 words, written in the first person, and highlight their passion and skill. Do not use markdown.`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
    });
    const text = response.text;
    
    // Clean up response, remove potential markdown like quotes
    return text.replace(/^"|"$/g, '').trim();

  } catch (error) {
    console.error("Error generating artist bio with Gemini:", error);
    throw new Error("Failed to generate bio. The AI service may be unavailable or the API key is invalid.");
  }
}