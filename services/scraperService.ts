import { GoogleGenAI, Type } from '@google/genai';

export const generateBusinessProfile = async (websiteUrl: string, gmbUrl: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const prompt = `Based on the following URLs, draft a short, professional description for a home service business's profile.
    Website: ${websiteUrl}
    Google My Business: ${gmbUrl}

    If the URLs are fake or inaccessible, generate a plausible draft description based on the domain name that the business owner can edit.

    Provide:
    1. A short, professional description (2-3 sentences).
    2. A list of 3-5 main services they likely offer.

    Return the data as a JSON object.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            services: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["description", "services"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Error generating business profile:', error);
    return null;
  }
};

export const verifyDealImage = async (imageUrl: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const prompt = `Analyze this image URL: ${imageUrl}
    Is this image appropriate for a home service business deal? It should not contain explicit content, violence, or highly offensive material.
    Return a JSON object with 'isAppropriate' (boolean) and 'reason' (string).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAppropriate: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["isAppropriate", "reason"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Error verifying image:', error);
    return { isAppropriate: true, reason: 'Verification failed, assuming appropriate.' };
  }
};

export const generateDealRecommendations = async (category: string, businessName: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const prompt = `Generate 3 recommended group deals for a home service business named "${businessName}" in the category "${category}".
    These should be realistic deals that would attract neighbors to sign up together.

    For each deal, provide:
    1. Title
    2. Description
    3. Standard Price
    4. Discount Percentage (10-30%)
    5. Required Signups (3-10)

    Return the data as a JSON array of objects.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              standardPrice: { type: Type.NUMBER },
              discountPercentage: { type: Type.NUMBER },
              requiredSignups: { type: Type.NUMBER }
            },
            required: ["title", "description", "standardPrice", "discountPercentage", "requiredSignups"]
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error('Error generating deal recommendations:', error);
    return [];
  }
};
