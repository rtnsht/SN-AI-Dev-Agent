'use client';

import type { ReactNode } from 'react';

import { Building2, BriefcaseBusiness, FolderKanban } from 'lucide-react';

import { FDEShell, type FDEShellProps } from '@/components/fde/FDEShell';

interface AppShellProps extends FDEShellProps {
  workspaceName?: string;
  spaceName?: string;
  projectName?: string;
  contextError?: string | null;
}

function Crumb({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 min-w-0"
      style={{
        background: 'var(--fde-surface-2)',
        border: '1px solid var(--fde-border-default)',
      }}
    >
      <span style={{ color: 'var(--fde-text-disabled)' }}>{icon}</span>
      <div className="min-w-0">
        <div
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--fde-text-disabled)' }}
        >
          {label}
        </div>
        <div className="text-[12px] font-medium truncate">
          {value || 'Loading...'}
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  workspaceName,
  spaceName,
  projectName,
  contextError,
  topContent,
  ...shellProps
}: AppShellProps) {
  const scaffoldTopContent = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Crumb icon={<Building2 className="w-3.5 h-3.5" />} label="Workspace" value={workspaceName} />
        <Crumb icon={<BriefcaseBusiness className="w-3.5 h-3.5" />} label="Space" value={spaceName} />
        <Crumb icon={<FolderKanban className="w-3.5 h-3.5" />} label="Project" value={projectName} />
      </div>
      {contextError ? (
        <div
          className="text-[11px] px-2"
          style={{ color: 'var(--fde-warning)' }}
        >
          {contextError}
        </div>
      ) : null}
      {topContent}
    </div>
  );

  return <FDEShell {...shellProps} topContent={scaffoldTopContent} />;
}

export default AppShell;
