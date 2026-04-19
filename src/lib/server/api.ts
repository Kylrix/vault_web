type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type GenerateAIResponseInput = {
  prompt: string;
  history?: AIChatMessage[];
  systemInstruction?: string;
  apiKey?: string;
};

export async function generateAIResponse(data: GenerateAIResponseInput): Promise<string> {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.apiKey ? { 'x-user-gemini-key': data.apiKey } : {}),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'AI request failed');
  }

  const payload = await response.json();
  return payload.text;
}

export async function purgeTier2Data(): Promise<{ success: true }> {
  const response = await fetch('/api/reset-purge', {
    method: 'POST',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Purge request failed');
  }

  return response.json();
}
