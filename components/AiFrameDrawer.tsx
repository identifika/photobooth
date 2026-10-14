'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Bot,
  Send,
  Settings,
  Check,
  Loader2,
  X,
  Key,
  Cpu,
  Layers,
  RotateCcw,
  Lock,
  Crown,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FramePreview from '@/components/FramePreview';
import type { FrameConfig } from '@/lib/frame-types';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/hooks/useAdmin';
import {
  type AiFrameCandidate,
  type AiProviderType,
  type AiAgentSettings,
  type AiChatMessage,
  type AiUsageStatus,
  loadAiAgentSettings,
  saveAiAgentSettings,
  requestFrameGeneration,
  fetchAiUsageStatus,
} from '@/lib/ai-agent';

interface AiFrameDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFrame: (config: FrameConfig, name: string, emoji: string) => void;
  isDark: boolean;
  currentConfig?: FrameConfig;
}

const QUICK_PROMPTS = [
  { label: '🌸 Pastel Kawaii (3p)', text: 'Cute pastel pink and lavender cloud aesthetic, 3 photos, floral stickers, sweet script title' },
  { label: '🎞️ Vintage Ticket (4p)', text: 'Vintage 90s cinema ticket strip with perforated ticket edges, 4 photos, typewriter text, date stamp' },
  { label: '💍 Elegant Wedding (2p)', text: 'Luxury ivory linen wedding duo, 2 photos, polished gold borders, calligraphy title, love stickers' },
  { label: '🖤 Midnight Noir (4p)', text: 'Dark moody monochrome noir, 4 photos in 2x2 grid, clean silver borders, minimalist title' },
  { label: '⚡ Cyber Neon (3p)', text: 'Electric cyberpunk neon purple and cyan gradient, 3 photos, futuristic font, tech stickers' },
];

export default function AiFrameDrawer({
  isOpen,
  onClose,
  onApplyFrame,
  isDark,
  currentConfig,
}: AiFrameDrawerProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const userIsAdmin = user ? isAdmin(user.email) : false;

  const [usage, setUsage] = useState<AiUsageStatus | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm your AI Frame Design Agent. Describe whatever frame you have in mind — colors, aesthetic, number of photo slots, text, or stickers — and I'll generate 1 to 3 full designs you can preview and select!",
      timestamp: Date.now(),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [candidateCount, setCandidateCount] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appliedCandidateId, setAppliedCandidateId] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<AiAgentSettings>(() => loadAiAgentSettings());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch usage stats whenever drawer opens or user changes
  useEffect(() => {
    if (isOpen && user) {
      setLoadingUsage(true);
      fetchAiUsageStatus()
        .then((st) => setUsage(st))
        .catch(() => {})
        .finally(() => setLoadingUsage(false));
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && user) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSaveSettings = (newSettings: AiAgentSettings) => {
    setSettings(newSettings);
    saveAiAgentSettings(newSettings);
  };

  const remainingPrompts = usage?.remainingToday !== null && usage?.remainingToday !== undefined
    ? usage.remainingToday
    : 3;
  const isDailyLimitReached = !!user && !userIsAdmin && remainingPrompts <= 0;

  const handleSend = async (textToSend?: string) => {
    if (!user) {
      router.push('/login?redirect=/editor');
      return;
    }

    if (isDailyLimitReached) return;

    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || loading) return;

    setInputPrompt('');
    const userMsgId = 'user_' + Date.now();
    const newUserMsg: AiChatMessage = {
      id: userMsgId,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await requestFrameGeneration({
        prompt,
        count: candidateCount,
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        baseUrl: settings.baseUrl,
        currentFrame: currentConfig,
        chatHistory: history,
      });

      if (result.usage) {
        setUsage(result.usage);
      } else if (!userIsAdmin && usage) {
        setUsage({
          ...usage,
          usedToday: usage.usedToday + 1,
          remainingToday: Math.max(0, (usage.remainingToday ?? 3) - 1),
        });
      }

      const assistantMsg: AiChatMessage = {
        id: 'assistant_' + Date.now(),
        role: 'assistant',
        content: result.message,
        timestamp: Date.now(),
        candidates: result.candidates,
        providerUsed: result.providerUsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Frame generation error:', err);
      const isLimitErr = err.message?.includes('daily limit') || err.message?.includes('DAILY_LIMIT_EXCEEDED');
      if (isLimitErr && !userIsAdmin) {
        setUsage((prev) => (prev ? { ...prev, remainingToday: 0, usedToday: 3 } : null));
      }
      const errorMsg: AiChatMessage = {
        id: 'error_' + Date.now(),
        role: 'assistant',
        content: err.message || 'An error occurred while generating frames. Please try again.',
        timestamp: Date.now(),
        error: err.message,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = (candidate: AiFrameCandidate) => {
    onApplyFrame(candidate.config, candidate.name, candidate.emoji);
    setAppliedCandidateId(candidate.id);
    setTimeout(() => setAppliedCandidateId(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[480px] shadow-2xl border-l flex flex-col transition-all duration-300 animate-in slide-in-from-right ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-800'
      }`}
    >
      {/* ── Header ── */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 border-b select-none ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-gray-100 bg-white/90'
        } backdrop-blur`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm leading-tight">AI Frame Studio</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-medium">
                Agent
              </span>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Multi-model generator · 1–3 variations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen((s) => !s)}
            className={`p-1.5 rounded-lg transition-colors ${
              settingsOpen
                ? 'bg-indigo-500/10 text-indigo-500'
                : isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
            }`}
            title="Configure AI Providers & API Keys"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Settings Accordion ── */}
      {settingsOpen && (
        <div
          className={`px-5 py-3 border-b text-xs space-y-3 animate-in fade-in duration-150 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-gray-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
              <Cpu className="w-3.5 h-3.5" /> LLM Provider Settings
            </span>
            <button
              onClick={() => handleSaveSettings({ provider: 'auto', apiKey: '', model: '', baseUrl: '' })}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-lg bg-black/5 dark:bg-white/5">
            {(['auto', 'gemini', 'groq', 'openai'] as AiProviderType[]).map((prov) => (
              <button
                key={prov}
                onClick={() => handleSaveSettings({ ...settings, provider: prov })}
                className={`py-1 text-[11px] font-medium rounded capitalize transition-all ${
                  settings.provider === prov
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {prov === 'auto' ? 'Auto' : prov === 'gemini' ? 'Gemini' : prov === 'groq' ? 'Groq' : 'OpenAI'}
              </button>
            ))}
          </div>

          {settings.provider !== 'auto' && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">
                  API Key ({settings.provider})
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => handleSaveSettings({ ...settings, apiKey: e.target.value })}
                    placeholder={`Enter ${settings.provider} API key...`}
                    className="text-xs h-7 pr-7 font-mono"
                  />
                  <Key className="w-3.5 h-3.5 absolute right-2 top-2 text-muted-foreground pointer-events-none opacity-40" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Stored securely in your local browser only. Leave blank to use server environment keys.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Model (optional override)</label>
                <Input
                  type="text"
                  value={settings.model || ''}
                  onChange={(e) => handleSaveSettings({ ...settings, model: e.target.value })}
                  placeholder={
                    settings.provider === 'gemini'
                      ? 'gemini-2.5-flash'
                      : settings.provider === 'groq'
                      ? 'llama-3.3-70b-versatile'
                      : 'gpt-4o-mini'
                  }
                  className="text-xs h-7 font-mono"
                />
              </div>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-200/40 dark:border-indigo-800/40">
            ⚡ <strong>Smart Engine Ready:</strong> Even without entering an API key, our built-in intelligent design engine creates aesthetic photobooth frames instantly.
          </div>
        </div>
      )}

      {/* ── Message / Chat Feed ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Sign In Required Notice (for non-authenticated users) */}
        {!authLoading && !user && (
          <div className={`rounded-2xl p-4 border text-center space-y-2.5 my-2 ${
            isDark ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider">Sign In Required</h3>
              <p className="text-[11px] opacity-80 mt-1 max-w-xs mx-auto leading-relaxed">
                AI Frame Studio is exclusively available for signed-in users. Sign in to enjoy 3 free AI frame generations every day!
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push('/login?redirect=/editor')}
              className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white w-full shadow-sm"
            >
              Sign In with Account
            </Button>
          </div>
        )}

        {/* Daily Limit Reached Banner (for non-admin users) */}
        {isDailyLimitReached && (
          <div className={`rounded-2xl p-3.5 border flex items-start gap-2.5 text-xs ${
            isDark ? 'bg-rose-950/30 border-rose-800/50 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="text-[11px]">
              <p className="font-bold">Daily Limit Reached (3 of 3 used)</p>
              <p className="opacity-80 mt-0.5">
                You have used your 3 free AI frame prompts for today. Your quota resets tomorrow at midnight!
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
          >
            {/* Message Bubble */}
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-xs'
                  : isDark
                  ? 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-xs'
                  : 'bg-gray-100 text-gray-800 border border-gray-200/60 rounded-bl-xs'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-indigo-400">
                  <Bot className="w-3.5 h-3.5" />
                  <span>Agent</span>
                  {msg.providerUsed && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-normal">
                      {msg.providerUsed}
                    </span>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>

            {/* Generated Candidate Frames Display */}
            {msg.candidates && msg.candidates.length > 0 && (
              <div className="w-full space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Generated Designs ({msg.candidates.length})
                  </span>
                  <span className="text-[10px] text-muted-foreground">Click to apply to canvas</span>
                </div>

                <div className="space-y-3">
                  {msg.candidates.map((cand) => {
                    const isApplied = appliedCandidateId === cand.id;
                    const photoCount =
                      cand.config.elements?.filter((e) => e.type === 'photo').length || 0;

                    return (
                      <div
                        key={cand.id}
                        className={`rounded-2xl border p-3.5 transition-all duration-200 ${
                          isDark
                            ? 'bg-slate-800/60 border-slate-700 hover:border-indigo-500/80 hover:bg-slate-800'
                            : 'bg-white border-gray-200 hover:border-indigo-500 hover:shadow-md'
                        } ${isApplied ? 'ring-2 ring-emerald-500 border-emerald-500' : ''}`}
                      >
                        {/* Candidate Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{cand.emoji}</span>
                              <h3 className="font-bold text-xs leading-snug">{cand.name}</h3>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              {cand.description}
                            </p>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 shrink-0 font-medium">
                            {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
                          </span>
                        </div>

                        {/* Interactive Frame Preview Render */}
                        <div
                          className={`w-full flex items-center justify-center p-3 rounded-xl border mb-3 overflow-hidden ${
                            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-gray-100'
                          }`}
                        >
                          <div className="scale-90 hover:scale-95 transition-transform duration-200 cursor-pointer shadow-md rounded overflow-hidden">
                            <FramePreview config={cand.config} scale={0.42} />
                          </div>
                        </div>

                        {/* Palette pills & details */}
                        <div className="flex items-center justify-between gap-2 mb-3 px-1 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-[10px]">Colors:</span>
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                              style={{ background: cand.config.color || '#fff' }}
                              title="Background"
                            />
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                              style={{ background: cand.config.borderColor || '#000' }}
                              title="Border"
                            />
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                              style={{ background: cand.config.accentColor || '#c9a84c' }}
                              title="Accent"
                            />
                          </div>

                          <span className="text-muted-foreground text-[10px] capitalize">
                            {cand.config.borderStyle || 'solid'} border
                          </span>
                        </div>

                        {/* Apply Button */}
                        <Button
                          size="sm"
                          onClick={() => handleSelectCandidate(cand)}
                          className={`w-full h-8 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                            isApplied
                              ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                          }`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Applied to Canvas!
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Select & Apply to Canvas
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading status */}
        {loading && (
          <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div
              className={`rounded-2xl px-4 py-2.5 text-xs ${
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <p className="font-medium flex items-center gap-2">
                Designing {candidateCount} frame variations...
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Calculating layout geometry, typography, and styling
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Prompts Bar ── */}
      <div className={`px-4 pt-2 pb-1 border-t ${isDark ? 'border-slate-800/80 bg-slate-900' : 'border-gray-100 bg-white'}`}>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => handleSend(p.text)}
              disabled={loading || !user || isDailyLimitReached}
              className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap border shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? 'border-slate-700/80 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600 text-slate-300'
                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input Box & Quota Controls ── */}
      <div
        className={`p-4 border-t ${
          isDark ? 'border-slate-800 bg-slate-950/40' : 'border-gray-100 bg-slate-50/50'
        }`}
      >
        {/* Quota & Options Bar */}
        <div className="flex items-center justify-between mb-2 text-[11px]">
          <div>
            {userIsAdmin ? (
              <span className="font-semibold text-amber-500 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> Admin: Unlimited Prompts
              </span>
            ) : user ? (
              <span className={`font-medium flex items-center gap-1 ${
                isDailyLimitReached ? 'text-rose-500 font-semibold' : 'text-indigo-600 dark:text-indigo-400'
              }`}>
                <Sparkles className="w-3 h-3" />
                {loadingUsage ? (
                  'Checking daily quota...'
                ) : (
                  `${remainingPrompts} of 3 prompts left today`
                )}
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-500" /> Sign in required
              </span>
            )}
          </div>

          {/* Count Selector Toggle (1 to 3) */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
            <span className="text-[10px] text-muted-foreground px-1">Frames:</span>
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                disabled={loading || !user || isDailyLimitReached}
                onClick={() => setCandidateCount(num)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors disabled:opacity-40 ${
                  candidateCount === num
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              !user
                ? 'Please sign in to generate frames with AI...'
                : isDailyLimitReached
                ? 'Daily limit of 3 prompts reached. Resets tomorrow!'
                : 'e.g. 3 photos, pastel lilac gradient, flower stickers...'
            }
            rows={2}
            disabled={loading || !user || isDailyLimitReached}
            className={`w-full p-2.5 pr-11 text-xs rounded-xl border outline-none resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-indigo-500'
                : 'bg-white border-gray-200 text-gray-800 focus:border-indigo-500'
            }`}
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading || !user || isDailyLimitReached}
            className="absolute right-2.5 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-white transition-all shadow-sm"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
