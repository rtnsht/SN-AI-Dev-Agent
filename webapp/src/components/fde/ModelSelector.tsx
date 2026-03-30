'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bot,
  BrainCircuit,
  Check,
  ChevronsUpDown,
  Cpu,
  Globe,
  Gauge,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';

import type { AIProvider, AITransport, ModelAccessSource, ModelOption } from '@/lib/types';

type ProviderFilter = AIProvider | 'all';

interface ModelCatalogResponse {
  models: ModelOption[];
  defaultModel: ModelOption | null;
  providers: AIProvider[];
}

export interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string, transport: AITransport) => void;
  disabled?: boolean;
  modelLocked?: boolean;
  className?: string;
  temporaryTransportAccess?: Partial<Record<AITransport, boolean>>;
  reloadKey?: number;
}

const PROVIDER_CONFIG: Record<AIProvider, { label: string; icon: ReactNode; accent: string }> = {
  anthropic: { label: 'Anthropic', icon: <Star className="w-4 h-4" />, accent: 'var(--color-primary)' },
  openai: { label: 'OpenAI', icon: <Bot className="w-4 h-4" />, accent: '#22c55e' },
  google: { label: 'Google', icon: <Sparkles className="w-4 h-4" />, accent: '#60a5fa' },
  mimo: { label: 'MiMo', icon: <BrainCircuit className="w-4 h-4" />, accent: '#f97316' },
  minimax: { label: 'MiniMax', icon: <Zap className="w-4 h-4" />, accent: '#06b6d4' },
  glm: { label: 'GLM', icon: <Cpu className="w-4 h-4" />, accent: '#a855f7' },
  openrouter: { label: 'OpenRouter', icon: <Globe className="w-4 h-4" />, accent: '#fb923c' },
  free: { label: 'Free Access', icon: <ShieldCheck className="w-4 h-4" />, accent: '#facc15' },
};

const DEFAULT_PROVIDERS: AIProvider[] = ['anthropic', 'openai', 'google', 'mimo', 'minimax', 'glm', 'openrouter', 'free'];

function formatPrice(model: ModelOption) {
  if (model.inputCostPer1m === 0 && model.outputCostPer1m === 0) return 'Free';
  return `$${model.inputCostPer1m}/$${model.outputCostPer1m} per 1M`;
}

function formatAccessLabel(source: ModelAccessSource | undefined) {
  switch (source) {
    case 'session_key':
      return { label: 'Session key', tone: 'rgba(59,130,246,0.18)', color: '#93c5fd' };
    case 'saved_key':
      return { label: 'Saved key', tone: 'rgba(34,197,94,0.18)', color: '#86efac' };
    case 'free_rule':
      return { label: 'Free rule', tone: 'rgba(250,204,21,0.16)', color: '#fde68a' };
    case 'server_key':
      return { label: 'Shared', tone: 'rgba(168,85,247,0.16)', color: '#d8b4fe' };
    default:
      return { label: 'Needs key', tone: 'rgba(244,63,94,0.16)', color: '#fda4af' };
  }
}

function isFreeBucket(model: ModelOption) {
  return model.accessSource === 'free_rule' || model.isFree || model.isServerFree;
}

function applyTemporaryAccess(
  model: ModelOption,
  temporaryTransportAccess: Partial<Record<AITransport, boolean>>
): ModelOption {
  if (model.available || !model.transport) return model;
  if (!temporaryTransportAccess[model.transport]) return model;

  return {
    ...model,
    available: true,
    accessSource: 'session_key',
    disabledReason: null,
  };
}

export function ModelSelector({
  selectedModel,
  onSelectModel,
  disabled = false,
  modelLocked = false,
  className = '',
  temporaryTransportAccess = {},
  reloadKey = 0,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>(DEFAULT_PROVIDERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch('/api/models', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || 'Failed to load models');
        }

        const payload = (await response.json()) as ModelCatalogResponse;
        if (cancelled) return;
        setModels(payload.models || []);
        setProviders(payload.providers || DEFAULT_PROVIDERS);
        setFocusedModelId(payload.defaultModel?.id || null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load models');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const effectiveModels = useMemo(
    () => models.map((model) => applyTemporaryAccess(model, temporaryTransportAccess)),
    [models, temporaryTransportAccess]
  );

  const selectedModelData = useMemo(
    () =>
      effectiveModels.find(
        (model) =>
          model.id === selectedModel ||
          model.modelId === selectedModel ||
          model.key === selectedModel
      ) || null,
    [effectiveModels, selectedModel]
  );

  const filteredModels = useMemo(() => {
    let nextModels = effectiveModels;

    if (activeProvider !== 'all') {
      nextModels = activeProvider === 'free'
        ? nextModels.filter((model) => isFreeBucket(model))
        : nextModels.filter((model) => model.provider === activeProvider);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      nextModels = nextModels.filter((model) =>
        model.label.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query) ||
        (model.key || '').toLowerCase().includes(query)
      );
    }

    return nextModels;
  }, [activeProvider, effectiveModels, searchQuery]);

  useEffect(() => {
    if (!filteredModels.length) {
      setFocusedModelId(null);
      return;
    }

    setFocusedModelId((current) => {
      if (current && filteredModels.some((model) => model.id === current)) {
        return current;
      }

      if (selectedModelData && filteredModels.some((model) => model.id === selectedModelData.id)) {
        return selectedModelData.id;
      }

      return filteredModels[0].id;
    });
  }, [filteredModels, selectedModelData]);

  const focusedModel = useMemo(
    () =>
      filteredModels.find((model) => model.id === focusedModelId) ||
      selectedModelData ||
      filteredModels[0] ||
      null,
    [filteredModels, focusedModelId, selectedModelData]
  );

  if (modelLocked && selectedModelData) {
    const providerMeta = PROVIDER_CONFIG[selectedModelData.provider];
    return (
      <div
        className={`flex items-center gap-2 rounded-md px-3 py-2 ${className}`}
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-emphasis)' }}
      >
        <span style={{ color: providerMeta.accent }}>{providerMeta.icon}</span>
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedModelData.label}</span>
        <span className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>(locked)</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${className}`}
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-emphasis)',
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <div className="min-w-0">
          {selectedModelData ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ color: PROVIDER_CONFIG[selectedModelData.provider].accent }}>
                  {PROVIDER_CONFIG[selectedModelData.provider].icon}
                </span>
                <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {selectedModelData.label}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                  {PROVIDER_CONFIG[selectedModelData.provider].label} via {selectedModelData.transport}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: formatAccessLabel(selectedModelData.accessSource).tone,
                    color: formatAccessLabel(selectedModelData.accessSource).color,
                  }}
                >
                  {formatAccessLabel(selectedModelData.accessSource).label}
                </span>
              </div>
            </>
          ) : (
            <span className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
              Select model
            </span>
          )}
        </div>
        <ChevronsUpDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-disabled)' }} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Model selector"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
            style={{ background: 'rgba(10, 10, 11, 0.72)' }}
            aria-label="Close model selector"
          />

          <div
            className="relative w-full max-w-6xl rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface-sidebar)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
            }}
          >
            <div
              className="flex items-center justify-between gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-default)' }}
            >
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Model Selector</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                  Pick a provider group, compare execution paths, and choose a model the current workspace can run.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md px-2.5 py-1.5 text-[11px]"
                style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-emphasis)', color: 'var(--text-secondary)' }}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px,minmax(0,1fr),300px] min-h-[580px] max-h-[min(720px,calc(100vh-5rem))]">
              <div
                className="p-4 space-y-3"
                style={{ borderRight: '1px solid var(--border-default)', background: 'var(--surface-secondary)' }}
              >
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-disabled)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search models"
                    className="w-full rounded-md pl-9 pr-3 py-2 text-[11px]"
                    style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-emphasis)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-1">
                  {(['all', ...providers] as ProviderFilter[]).map((provider) => {
                    const meta = provider === 'all'
                      ? { label: 'All Models', icon: <Gauge className="w-4 h-4" />, accent: 'var(--text-secondary)' }
                      : PROVIDER_CONFIG[provider];
                    const active = activeProvider === provider;

                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => setActiveProvider(provider)}
                        className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] transition-colors"
                        style={{
                          background: active ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 22%, transparent)' : 'transparent'}`,
                        }}
                      >
                        <span style={{ color: meta.accent }}>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 flex flex-col">
                <div
                  className="px-4 py-3 flex items-center justify-between text-[11px]"
                  style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  <span>{filteredModels.length} model{filteredModels.length === 1 ? '' : 's'} available in this view</span>
                  <span>{selectedModelData ? `Current: ${selectedModelData.label}` : 'No model selected'}</span>
                </div>

                <div className="min-h-0 overflow-y-auto">
                  {loading ? (
                    <div className="p-6 text-[11px]" style={{ color: 'var(--text-disabled)' }}>Loading model catalog…</div>
                  ) : loadError ? (
                    <div className="p-6">
                      <div
                        className="rounded-md px-3 py-2 text-[11px]"
                        style={{ background: 'rgba(249,115,115,0.08)', border: '1px solid rgba(249,115,115,0.22)', color: '#fda4af' }}
                      >
                        {loadError}
                      </div>
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="p-6 text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                      No models match this filter yet.
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                      {filteredModels.map((model) => {
                        const providerMeta = PROVIDER_CONFIG[model.provider];
                        const isSelected = selectedModelData?.id === model.id;
                        const isFocused = focusedModel?.id === model.id;
                        const accessMeta = formatAccessLabel(model.accessSource);

                        return (
                          <button
                            key={model.id}
                            type="button"
                            onMouseEnter={() => setFocusedModelId(model.id)}
                            onFocus={() => setFocusedModelId(model.id)}
                            onClick={() => {
                              if (!model.available || !model.transport) return;
                              onSelectModel(model.id, model.transport);
                              setIsOpen(false);
                            }}
                            disabled={!model.available}
                            className="w-full px-4 py-3 text-left transition-colors disabled:cursor-not-allowed"
                            style={{
                              background: isFocused
                                ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)'
                                : isSelected
                                  ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                                  : 'transparent',
                              opacity: model.available ? 1 : 0.68,
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5" style={{ color: providerMeta.accent }}>
                                {providerMeta.icon}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {model.label}
                                  </span>
                                  {model.isDefault && <Star className="w-3.5 h-3.5" style={{ color: '#facc15' }} />}
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                                    style={{ background: accessMeta.tone, color: accessMeta.color }}
                                  >
                                    {accessMeta.label}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                                  <span>{providerMeta.label}</span>
                                  <span>via {model.transport}</span>
                                  <span>{Math.round(model.contextWindow / 1000)}K ctx</span>
                                  <span>{formatPrice(model)}</span>
                                </div>
                                {!model.available && model.disabledReason ? (
                                  <p className="mt-1 text-[10px]" style={{ color: '#fda4af' }}>
                                    {model.disabledReason}
                                  </p>
                                ) : null}
                              </div>
                              {isSelected ? (
                                <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                              ) : !model.available ? (
                                <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-disabled)' }} />
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div
                className="p-4 space-y-4"
                style={{ borderLeft: '1px solid var(--border-default)', background: 'var(--surface-secondary)' }}
              >
                {focusedModel ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span style={{ color: PROVIDER_CONFIG[focusedModel.provider].accent }}>
                          {PROVIDER_CONFIG[focusedModel.provider].icon}
                        </span>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {focusedModel.label}
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                            {PROVIDER_CONFIG[focusedModel.provider].label} via {focusedModel.transport}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: formatAccessLabel(focusedModel.accessSource).tone,
                            color: formatAccessLabel(focusedModel.accessSource).color,
                          }}
                        >
                          {formatAccessLabel(focusedModel.accessSource).label}
                        </span>
                        {focusedModel.remainingQuota !== null && focusedModel.dailyLimit !== null ? (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(250,204,21,0.12)', color: '#fde68a' }}
                          >
                            {focusedModel.remainingQuota}/{focusedModel.dailyLimit} left today
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {[
                        ['Class', focusedModel.modelClass || 'standard'],
                        ['Speed', focusedModel.speedTier || 'medium'],
                        ['Cost', focusedModel.costTier || 'medium'],
                        ['Context', `${Math.round(focusedModel.contextWindow / 1000)}K`],
                        ['Max output', `${focusedModel.maxOutput.toLocaleString()} tokens`],
                        ['Training data', focusedModel.trainingData || 'Provider managed'],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-md px-3 py-2"
                          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-emphasis)' }}
                        >
                          <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>{label}</div>
                          <div className="mt-1 font-medium" style={{ color: 'var(--text-primary)' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="rounded-md px-3 py-2"
                      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-emphasis)' }}
                    >
                      <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>Capabilities</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {focusedModel.capabilities.map((capability) => (
                          <span
                            key={capability}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(59,130,246,0.12)', color: '#bfdbfe' }}
                          >
                            {capability}
                          </span>
                        ))}
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: focusedModel.thinkingModeSupported ? 'rgba(168,85,247,0.14)' : 'rgba(113,113,122,0.16)',
                            color: focusedModel.thinkingModeSupported ? '#d8b4fe' : '#a1a1aa',
                          }}
                        >
                          Thinking {focusedModel.thinkingModeSupported ? 'supported' : 'not supported'}
                        </span>
                      </div>
                    </div>

                    <div
                      className="rounded-md px-3 py-2 text-[11px]"
                      style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-emphasis)' }}
                    >
                      <div className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>Quality controls</div>
                      <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Requests stay inside the current project guardrails, selected tool policy, and phase gating rules before they ever reach this model.
                      </p>
                    </div>

                    {!focusedModel.available && focusedModel.disabledReason ? (
                      <div
                        className="rounded-md px-3 py-2 text-[11px]"
                        style={{ background: 'rgba(249,115,115,0.08)', border: '1px solid rgba(249,115,115,0.22)', color: '#fda4af' }}
                      >
                        {focusedModel.disabledReason}
                      </div>
                    ) : null}

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={!focusedModel.available || !focusedModel.transport}
                        onClick={() => {
                          if (!focusedModel.available || !focusedModel.transport) return;
                          onSelectModel(focusedModel.id, focusedModel.transport);
                          setIsOpen(false);
                        }}
                        className="w-full rounded-md px-3 py-2 text-[11px] font-medium disabled:cursor-not-allowed"
                        style={{
                          background: focusedModel.available ? 'var(--color-primary)' : 'var(--surface-elevated)',
                          color: focusedModel.available ? '#fff' : 'var(--text-disabled)',
                          border: focusedModel.available ? 'none' : '1px solid var(--border-emphasis)',
                          opacity: focusedModel.available ? 1 : 0.7,
                        }}
                      >
                        {focusedModel.available ? 'Use this model' : 'Unavailable in current setup'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                    Pick a provider group to inspect model details.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
