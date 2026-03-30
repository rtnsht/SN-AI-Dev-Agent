'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { SDLCPhase } from '@/lib/types';
import TabBar, { type Tab } from '@/components/fde/TabBar';
import { NavRailCollapsed } from '@/components/fde/NavRailCollapsed';

export interface FDEShellMode {
  id: string;
  label: string;
  color: string;
}

export interface FDEShellProps {
  appName: string;
  appLogo?: string;
  connected: boolean;
  instanceLabel?: string;
  phase: SDLCPhase;
  phaseProgress?: number;
  fdeMode: string;
  modes: readonly FDEShellMode[];
  onModeChange: (mode: string) => void;
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewQuickTab: () => void;
  onNewChat: () => void;
  settingsOpen: boolean;
  settingsWidth: number;
  onSettingsToggle: () => void;
  settingsContent: ReactNode;
  showRightPanel: boolean;
  rightPanelWidth: number;
  onToggleRightPanel: () => void;
  rightPanelContent?: ReactNode;
  headerActions?: ReactNode;
  onOpenChatList?: () => void;
  onOpenTools?: () => void;
  onOpenAgents?: () => void;
  topContent?: ReactNode;
  children: ReactNode;
}

export function FDEShell({
  appName,
  appLogo,
  connected,
  instanceLabel,
  phase,
  phaseProgress = 0,
  fdeMode,
  modes,
  onModeChange,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewQuickTab,
  onNewChat,
  settingsOpen,
  settingsWidth,
  onSettingsToggle,
  settingsContent,
  showRightPanel,
  rightPanelWidth,
  onToggleRightPanel,
  rightPanelContent,
  headerActions,
  onOpenChatList,
  onOpenTools,
  onOpenAgents,
  topContent,
  children,
}: FDEShellProps) {
  return (
    <div
      className="flex h-screen relative"
      data-layout="fde"
      style={{ background: 'var(--fde-surface-1)', color: 'var(--fde-text-primary)' }}
    >
      {settingsOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 hidden sm:block md:hidden"
          onClick={onSettingsToggle}
        />
      )}

      <div className="hidden sm:block flex-shrink-0">
        <NavRailCollapsed
          phase={phase}
          phaseProgress={phaseProgress}
          instanceIndicators={instanceLabel ? { connected, name: instanceLabel } : { connected }}
          onPhaseClick={() => {}}
          onSettingsClick={onSettingsToggle}
          onNewChatClick={onNewChat}
          onOpenChatList={onOpenChatList}
          onOpenTools={onOpenTools}
          onOpenAgents={onOpenAgents}
        />
      </div>

      <aside
        className={`hidden sm:flex ${
          settingsOpen ? 'translate-x-0' : '!w-0 -translate-x-full md:translate-x-0'
        } fixed md:static inset-y-0 left-16 z-40 md:z-auto transition-all duration-300 overflow-hidden flex-shrink-0`}
        style={{
          width: settingsOpen ? settingsWidth : 0,
          background: 'var(--fde-surface-2)',
          borderRight: '1px solid var(--fde-border-default)',
        }}
      >
        <div className="flex-1 overflow-hidden">{settingsContent}</div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header
          className="flex items-center justify-between gap-3 px-4 py-2"
          style={{
            background: 'var(--fde-surface-2)',
            borderBottom: '1px solid var(--fde-border-default)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity" title="Home">
              {appLogo ? (
                <Image src={appLogo} alt={appName} width={30} height={30} className="rounded-full flex-shrink-0" unoptimized priority />
              ) : null}
              <span className="text-sm font-semibold truncate">{appName}</span>
            </Link>
            {instanceLabel ? (
              <span
                className="hidden sm:flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded"
                style={{
                  background: connected ? 'rgba(56, 201, 118, 0.08)' : 'rgba(255,255,255,0.05)',
                  color: connected ? 'var(--fde-success)' : 'var(--fde-text-disabled)',
                  border: '1px solid var(--fde-border-default)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: connected ? 'var(--fde-success)' : 'var(--fde-text-disabled)' }}
                />
                {connected ? instanceLabel : 'Not connected'}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">{headerActions}</div>
        </header>

        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onTabClick={onTabClick}
          onTabClose={onTabClose}
          onNewQuickTab={onNewQuickTab}
        />

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto flex-shrink-0"
          style={{ background: 'var(--fde-surface-2)', borderBottom: '1px solid var(--fde-border-default)' }}
        >
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`fde-mode-pill whitespace-nowrap ${fdeMode === mode.id ? 'fde-mode-pill-selected' : ''}`}
              style={fdeMode === mode.id ? { borderColor: mode.color, color: mode.color } : undefined}
            >
              {mode.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onToggleRightPanel}
            className="fde-button fde-button-secondary text-xs"
          >
            {showRightPanel ? 'Hide outline' : 'Show outline'}
          </button>
        </div>

        {topContent ? (
          <div
            className="px-3 py-2 flex-shrink-0"
            style={{ background: 'var(--fde-surface-1)', borderBottom: '1px solid var(--fde-border-default)' }}
          >
            {topContent}
          </div>
        ) : null}

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 flex flex-col">{children}</div>
          {connected && (
            <aside
              className={`hidden lg:flex flex-col transition-all duration-300 overflow-hidden flex-shrink-0 ${
                showRightPanel ? 'translate-x-0 opacity-100' : 'w-0 translate-x-full opacity-0'
              }`}
              style={{
                width: showRightPanel ? rightPanelWidth : 0,
                background: 'var(--fde-surface-2)',
                borderLeft: '1px solid var(--fde-border-default)',
              }}
            >
              <div className="flex-1 min-h-0 overflow-y-auto">{rightPanelContent}</div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
