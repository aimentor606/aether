'use client';

import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useAuth } from '@/components/AuthProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function OpsSidebarFooter() {
  const { user, signOut } = useAuth();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'A';

  return (
    <SidebarFooter className="border-t border-sidebar-border p-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Back to Workspace">
            <Link href="/dashboard" className="text-sidebar-foreground/70">
              <ArrowLeft className="size-4" />
              <span>Back to Workspace</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px] bg-sidebar-accent">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-sidebar-foreground/60 truncate flex-1">
              {user?.email || 'Admin'}
            </span>
            <button
              onClick={() => signOut()}
              className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
