'use client';

import { Sidebar, SidebarRail } from '@/components/ui/sidebar';
import { OpsSidebarHeader } from './ops-sidebar-header';
import { OpsSidebarNav } from './ops-sidebar-nav';
import { OpsSidebarFooter } from './ops-sidebar-footer';

export function OpsSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <OpsSidebarHeader />
      <OpsSidebarNav />
      <OpsSidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}
