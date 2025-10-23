// @/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/genai";

// IMPORTANT: This service will not work without a valid API key.
// See README.md for instructions on how to set up your .env file.
const geminiApiKey = import.meta.env.VITE_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (!geminiApiKey) {
    console.error("Gemini API key (VITE_API_KEY) is missing from .env file. AI features will be disabled.");
} else {
    genAI = new GoogleGenerativeAI(geminiApiKey);
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
      throw new Error("AI service is not configured. Please check your API key in the .env file.");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const prompt = `Write a short, professional, and engaging bio for a tattoo artist named ${name}. They specialize in ${specialty} and are based in ${city}. The bio should be around 50-70 words, written in the first person, and highlight their passion and skill. Do not use markdown.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up response, remove potential markdown like quotes
    return text.replace(/^"|"$/g, '').trim();

  } catch (error) {
    console.error("Error generating artist bio with Gemini:", error);
    throw new Error("Failed to generate bio. The AI service may be unavailable or the API key is invalid.");
  }
}
