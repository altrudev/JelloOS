import { GoogleGenAI, Type } from "@google/genai";

// Defensive check for environments where process.env might be missing
const getApiKey = () => {
    try {
        return process?.env?.API_KEY || "";
    } catch (e) {
        return "";
    }
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const predictNextPhrases = async (
  currentText: string,
  context: string = "general conversation"
): Promise<string[]> => {
  if (!ai) {
    console.warn("Gemini API Key not found. Returning mock predictions.");
    return ["Hello there", "Thank you", "I need help"];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are an assistive communication AI for a person with ALS using an eye-tracking device.
        Context: ${context}.
        The user has typed: "${currentText}".
        Suggest 3 short, likely next phrases or sentence completions.
        Keep them concise (under 6 words).
        Return ONLY a JSON array of strings.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    
    const suggestions = JSON.parse(jsonText.trim()) as string[];
    return suggestions.slice(0, 3);
  } catch (error) {
    console.error("Gemini prediction error:", error);
    return ["Yes", "No", "Maybe"];
  }
};

export const getSmartSuggestionsByTime = async (): Promise<string[]> => {
    if (!ai) return ["I am hungry", "I am thirsty", "I am tired", "Hello"];
    
    const hour = new Date().getHours();
    let timeOfDay = "day";
    if (hour < 12) timeOfDay = "morning";
    else if (hour < 18) timeOfDay = "afternoon";
    else timeOfDay = "evening";

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
              Suggest 4 common needs or greetings for a paralyzed patient during the ${timeOfDay}.
              Examples: "I want coffee" (morning), "Turn off lights" (night).
              Return ONLY a JSON array of strings.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
         const jsonText = response.text;
         if (!jsonText) return ["Water", "Help", "Yes", "No"];
         return JSON.parse(jsonText.trim());
    } catch (e) {
        return ["Water please", "Bathroom", "Adjust position", "Yes"];
    }
}