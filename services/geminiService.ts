// @/services/geminiService.ts
// FIX: Removed 'Schema' from import as it's not needed and the cast was incorrect.
import { GoogleGenAI, Type } from "@google/genai";
import type { ArtistService } from '../types';

// FIX: Per coding guidelines, API key must come exclusively from process.env.API_KEY.
// The API key is assumed to be pre-configured and available.
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a professional bio for a tattoo artist using the Gemini API.
 */
export async function generateArtistBio(name: string, specialty: string, city: string): Promise<string> {
  // FIX: Removed check for genAI, assuming it's always initialized per guidelines.
  const model = "gemini-2.5-flash";
  const prompt = `Write a short, professional, and engaging bio for a tattoo artist named ${name}. They specialize in ${specialty} and are based in ${city}. The bio should be around 50-70 words, written in the first person, and highlight their passion and skill. Do not use markdown.`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
    });
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    // Clean up response, remove potential markdown like quotes
    return text.replace(/^"|"$/g, '').trim();

  } catch (error) {
    console.error("Error generating artist bio with Gemini:", error);
    throw new Error("Failed to generate bio. The AI service may be unavailable or the API key is invalid.");
  }
}

/**
 * Suggests an appropriate tattoo service based on tattoo dimensions using Gemini JSON Schema.
 */
export async function suggestTattooService(width: number, height: number, services: ArtistService[]): Promise<string> {
  // FIX: Removed check for genAI, assuming it's always initialized per guidelines.
   if (services.length === 0) {
    throw new Error("This artist has not defined any services to choose from.");
  }

  const model = "gemini-2.5-flash";
  const area = width * height;

  const servicesString = services.map(s => 
    `- ID: "${s.id}", Name: "${s.name}", Duration: ${s.duration} hours, Size Range: ${s.minSize || 'any'} to ${s.maxSize || 'any'} sq.in.`
  ).join('\n');
  
  const prompt = `A client wants a tattoo that is approximately ${width} inches wide by ${height} inches high. The total area is ${area} square inches.
  
  Available Services:
  ${servicesString}
  
  Select the ID of the most appropriate service based on the size/area coverage.`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        // FIX: Removed unnecessary 'Schema' cast. The object literal is correct.
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            serviceId: {
              type: Type.STRING,
              description: "The ID of the best matching service from the provided list.",
            },
          },
          required: ["serviceId"],
        },
      },
    });

    const json = JSON.parse(response.text || "{}");
    const suggestedId = json.serviceId;
    
    // Validate that the returned ID is one of the available service IDs
    const isValidId = services.some(s => s.id === suggestedId);

    if (isValidId) {
      return suggestedId;
    } else {
      console.warn(`Gemini returned an invalid service ID: "${suggestedId}". Falling back to logic.`);
      return fallbackServiceLogic(area, services);
    }

  } catch (error) {
    console.error("Error suggesting tattoo service with Gemini:", error);
    // Fallback to logic if AI fails
    return fallbackServiceLogic(area, services);
  }
}

function fallbackServiceLogic(area: number, services: ArtistService[]): string {
    // 1. Try to match by size range first
    const directMatch = services.find(s => area >= (s.minSize || 0) && area <= (s.maxSize || Infinity));
    if (directMatch) return directMatch.id;
    
    // 2. Fallback to estimating hours
    let estimatedHours = 1.5;
    if (area > 4 && area <= 16) estimatedHours = 3;
    else if (area > 16 && area <= 36) estimatedHours = 5;
    else if (area > 36) estimatedHours = 8;

    const closestService = services.reduce((prev, curr) => 
      Math.abs(curr.duration - estimatedHours) < Math.abs(prev.duration - estimatedHours) ? curr : prev
    );
    return closestService.id;
}