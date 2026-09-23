import { GoogleGenAI } from "@google/genai";

// Free-tier Flash-Lite model — generous free quota (30 requests/min, 1500/day
// at time of writing) for the small tasks this app asks of it. Google's Gemini
// model lineup moves fast; if this ID is ever retired, swap it for the current
// Flash-Lite-tier model at https://ai.google.dev/gemini-api/docs/models.
export const GEMINI_MODEL_ID = "gemini-3.1-flash-lite";

export const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
