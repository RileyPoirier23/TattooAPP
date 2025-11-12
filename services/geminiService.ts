// @/services/geminiService.ts
import { GoogleGenAI } from "@google/genai";
import type { ArtistService } from '../types';

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

/**
 * Suggests an appropriate tattoo service based on tattoo dimensions and the artist's available services.
 * @param width The width of the tattoo in inches.
 * @param height The height of the tattoo in inches.
 * @param services The list of available services from the artist.
 * @returns A promise that resolves to the ID of the suggested service.
 */
export async function suggestTattooService(width: number, height: number, services: ArtistService[]): Promise<string> {
  if (!genAI) {
      throw new Error("AI service is not configured.");
  }
   if (services.length === 0) {
    throw new Error("This artist has not defined any services to choose from.");
  }

  const model = "gemini-2.5-flash";
  const servicesString = services.map(s => `- ID: "${s.id}", Name: "${s.name}", Duration: ${s.duration} hours`).join('\n');
  const prompt = `A client wants a tattoo that is approximately ${width} inches wide by ${height} inches high.
The total area is ${width * height} square inches. A rough guide for tattoo time is: 1-4 sq.in = ~1-2 hours, 5-16 sq.in = ~2-4 hours, 17-36 sq.in = ~4-6 hours, >36 sq.in = 6+ hours.

Given the following list of available tattoo services, which one is the most appropriate for a tattoo of this size?

${servicesString}

Consider the typical time it takes to tattoo an area of this size. Choose the service that provides the most suitable duration.
Return ONLY the ID string of the most appropriate service from the list. Do not add any other text, explanation, or quotation marks.`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
    });
    const suggestedId = response.text.trim().replace(/"/g, '');
    
    // Validate that the returned ID is one of the available service IDs
    const isValidId = services.some(s => s.id === suggestedId);

    if (isValidId) {
      return suggestedId;
    } else {
      console.warn(`Gemini returned an invalid or unexpected service ID: "${suggestedId}". Falling back to default logic.`);
      // Fallback logic: find the service with the duration closest to a calculated estimate.
      const area = width * height;
      let estimatedHours = 1;
      if (area > 4 && area <= 16) estimatedHours = 3;
      else if (area > 16 && area <= 36) estimatedHours = 5;
      else if (area > 36) estimatedHours = 8;

      const closestService = services.reduce((prev, curr) => 
        Math.abs(curr.duration - estimatedHours) < Math.abs(prev.duration - estimatedHours) ? curr : prev
      );
      return closestService.id;
    }

  } catch (error) {
    console.error("Error suggesting tattoo service with Gemini:", error);
    throw new Error("Failed to suggest a service. The AI service may be unavailable.");
  }
}