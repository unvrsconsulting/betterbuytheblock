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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/s;

// Turns either a data: URL (already-read file upload) or an https URL
// (pasted link) into raw base64 + mime type Gemini can actually look at.
// Earlier this just pasted the URL string into the text prompt, which Gemini
// has no way to fetch — it was never actually looking at the image, just
// guessing from the filename/URL text.
async function fetchImageAsBase64(imageUrl: string): Promise<{ mimeType: string; data: string }> {
  const dataUrlMatch = imageUrl.match(DATA_URL_PATTERN);
  if (dataUrlMatch) {
    const [, mimeType, data] = dataUrlMatch;
    const approxBytes = (data.length * 3) / 4;
    if (approxBytes > MAX_IMAGE_BYTES) throw new Error('Image is too large to verify.');
    return { mimeType, data };
  }

  if (!/^https?:\/\//i.test(imageUrl)) throw new Error('Image must be a valid image file or https URL.');

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!imgRes.ok) throw new Error('Could not fetch that image URL.');
  const mimeType = imgRes.headers.get('content-type') || '';
  if (!mimeType.startsWith('image/')) throw new Error('That URL is not an image.');
  const buffer = await imgRes.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is too large to verify.');
  return { mimeType, data: Buffer.from(buffer).toString('base64') };
}

async function verifyDealImage(imageUrl: string) {
  const { mimeType, data } = await fetchImageAsBase64(imageUrl);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const prompt = `Look at this image, which a home-service business wants to use on a neighborhood deals listing site.
  Is it appropriate for that context? It must not contain explicit/sexual content, graphic violence, hate symbols, or other highly offensive material.
  It's fine if the image is unrelated or low-quality — only flag it for actually inappropriate content, not for being a bad fit.
  Return a JSON object with 'isAppropriate' (boolean) and 'reason' (a short string explaining the decision either way).`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, { inlineData: { mimeType, data } }],
      },
    ],
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
