import type { FrameConfig } from './frame-types';
import { getClientAuthToken } from './auth-client';
import { getApiUrl } from './api-config';

/**
 * AI calls go to the standalone gateway when NEXT_PUBLIC_AI_GATEWAY_URL is set
 * (`/v1/generate`). Otherwise they follow the normal API base, which may itself
 * be the gateway via NEXT_PUBLIC_API_URL (`/api/frames/ai-agent`).
 */
export function resolveAiGatewayUrl(): string {
  const dedicated = process.env.NEXT_PUBLIC_AI_GATEWAY_URL?.trim();
  if (dedicated) {
    return `${dedicated.replace(/\/$/, '')}/v1/generate`;
  }
  return getApiUrl('/api/frames/ai-agent');
}

export interface AiFrameCandidate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  layout?: string;
  config: FrameConfig;
}

export type AiProviderType = 'auto' | 'gemini' | 'groq' | 'openai' | 'custom';

export interface AiAgentSettings {
  provider: AiProviderType;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AiUsageStatus {
  authenticated: boolean;
  isAdmin: boolean;
  usedToday: number;
  maxDaily: number | null;
  remainingToday: number | null;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  candidates?: AiFrameCandidate[];
  providerUsed?: string;
  error?: string;
}

const SETTINGS_STORAGE_KEY = 'pb_ai_frame_agent_settings';

export const DEFAULT_AI_SETTINGS: AiAgentSettings = {
  provider: 'auto',
  apiKey: '',
  model: '',
  baseUrl: '',
};

export function loadAiAgentSettings(): AiAgentSettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiAgentSettings(settings: AiAgentSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save AI agent settings:', err);
  }
}

export interface GenerateFramesPayload {
  prompt: string;
  count: number;
  provider: AiProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  currentFrame?: FrameConfig;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface GenerateFramesResult {
  message: string;
  candidates: AiFrameCandidate[];
  providerUsed: string;
  usage?: AiUsageStatus;
}

export async function fetchAiUsageStatus(): Promise<AiUsageStatus> {
  try {
    const token = await getClientAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(resolveAiGatewayUrl(), { headers });
    if (!res.ok) {
      return {
        authenticated: false,
        isAdmin: false,
        usedToday: 0,
        maxDaily: 3,
        remainingToday: 0,
      };
    }
    return await res.json();
  } catch {
    return {
      authenticated: false,
      isAdmin: false,
      usedToday: 0,
      maxDaily: 3,
      remainingToday: 0,
    };
  }
}

export async function requestFrameGeneration(payload: GenerateFramesPayload): Promise<GenerateFramesResult> {
  const token = await getClientAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(resolveAiGatewayUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errMessage = 'Failed to generate frame';
    try {
      const errJson = await res.json();
      if (errJson.error) errMessage = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  return await res.json();
}
