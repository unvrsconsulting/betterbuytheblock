import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

// Every Gemini call for the site runs through here instead of in the browser.
// The old client-side code (services/scraperService.ts, AIRequestDealPanel)
// created a GoogleGenAI client directly in the page, which bakes
// GEMINI_API_KEY into the shipped JS bundle — anyone could read it out of
// devtools and burn the owner's quota. This route is the only place that ever
// touches process.env.GEMINI_API_KEY.

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

async function verifyDealImage(imageUrl: string) {
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
          reason: { type: Type.STRING },
        },
        required: ['isAppropriate', 'reason'],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}

async function generateDealRecommendations(category: string, businessName: string) {
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
            requiredSignups: { type: Type.NUMBER },
          },
          required: ['title', 'description', 'standardPrice', 'discountPercentage', 'requiredSignups'],
        },
      },
    },
  });

  return JSON.parse(response.text || '[]');
}

async function generateDealRequestMessage(businessName: string, requestText: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const prompt = `You are an AI assistant helping a user request a custom deal from a local business named "${businessName}".
  The user's request is: "${requestText}".
  Generate a professional, compelling deal request that is competitive to other similar companies and offers available in the area.
  Format the response as a short, persuasive message to the business owner, suggesting a fair group discount if multiple neighbors sign up.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
  });

  return response.text || '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests, please slow down.' });
  }

  const { action, ...params } = req.body || {};

  try {
    switch (action) {
      case 'verifyDealImage': {
        if (!params.imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
        return res.status(200).json(await verifyDealImage(params.imageUrl));
      }
      case 'generateDealRecommendations': {
        if (!params.category || !params.businessName) {
          return res.status(400).json({ error: 'category and businessName are required' });
        }
        return res.status(200).json(await generateDealRecommendations(params.category, params.businessName));
      }
      case 'generateDealRequestMessage': {
        if (!params.businessName || !params.requestText) {
          return res.status(400).json({ error: 'businessName and requestText are required' });
        }
        const text = await generateDealRequestMessage(params.businessName, params.requestText);
        return res.status(200).json({ text });
      }
      default:
        return res.status(400).json({ error: 'unknown action' });
    }
  } catch (err) {
    console.error('AI action failed', action, err);
    return res.status(500).json({ error: 'AI request failed' });
  }
}
