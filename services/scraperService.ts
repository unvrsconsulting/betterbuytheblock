// Gemini calls run server-side in api/ai.ts — see that file for why. This
// module just wraps the fetch calls so components don't touch the endpoint
// shape directly.

async function callAi(action: string, params: Record<string, unknown>) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  return res.json();
}

export const verifyDealImage = async (imageUrl: string) => {
  try {
    return await callAi('verifyDealImage', { imageUrl });
  } catch (error) {
    console.error('Error verifying image:', error);
    // Fail closed, not open — a moderation check that silently approves
    // whatever it couldn't check defeats the point of having one.
    return { isAppropriate: false, reason: "Couldn't verify this image right now — please try again." };
  }
};

export const generateDealRecommendations = async (category: string, businessName: string) => {
  try {
    return await callAi('generateDealRecommendations', { category, businessName });
  } catch (error) {
    console.error('Error generating deal recommendations:', error);
    return [];
  }
};
