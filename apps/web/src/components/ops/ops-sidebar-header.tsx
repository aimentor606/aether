'use client';

import { AetherLogo } from '@/components/sidebar/aether-logo';
import { SidebarHeader } from '@/components/ui/sidebar';

export function OpsSidebarHeader() {
  return (
    <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
      <div className="flex items-center gap-3">
        <AetherLogo size={22} />
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-sidebar-foreground">
            Operations
          </span>
          <span className="text-[11px] text-sidebar-foreground/50">
            Admin Console
          </span>
        </div>
      </div>
    </SidebarHeader>
  );
}
