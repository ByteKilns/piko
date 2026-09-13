"use client";

import { useState } from "react";

import {
  BarChart3,
  Bell,
  ChevronDown,
  HandCoins,
  Home,
  List,
  LogOut,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { cn } from "@/lib/utils";
import { AddExpenseModal } from "@/modules/expenses/components/AddExpenseModal";
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";


type NavItem = { enabled: boolean; href: string; icon: LucideIcon; label: string; };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, enabled: true },
  { href: "/expenses", label: "Expenses", icon: Receipt, enabled: true },
  { href: "/budget", label: "Budget", icon: Wallet, enabled: true },
  { href: "/recurring", label: "Recurring", icon: Repeat, enabled: true },
  { href: "/savings-goals", label: "Savings Goals", icon: PiggyBank, enabled: true },
  { href: "/loans", label: "Loans", icon: HandCoins, enabled: true },
  { href: "/dhuku", label: "Dhuku", icon: Users, enabled: true },
  { href: "/reports", label: "Reports", icon: BarChart3, enabled: true },
  { href: "/categories", label: "Categories", icon: List, enabled: true },
  { href: "/notifications", label: "Notifications", icon: Bell, enabled: true },
  { href: "/settings", label: "Settings", icon: Settings, enabled: true },
];

type Member = { id: string; image: null | string; name: string };
type Category = { groupName: string; id: string; name: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  initialCollapsed: boolean;
  members: Member[];
  realMemberId: string;
  unreadNotifications: number;
  viewingAsMemberId: string;
};

export function SidebarNav({
  categories,
  currentMemberId,
  initialCollapsed,
  members,
  realMemberId,
  unreadNotifications,
  viewingAsMemberId,
}: Props) {
  const pathname = usePathname();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const realMember = members.find((m) => m.id === realMemberId);
  const realMemberName = realMember?.name ?? "Me";

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COLLAPSED_COOKIE_NAME}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto p-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "mb-6 flex items-center gap-2",
          collapsed ? "flex-col" : "justify-between",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            collapsed && "flex-col",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-base leading-tight font-semibold">
                Piko
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Plan together, grow together
              </p>
            </div>
          )}
        </div>
        <button
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <Button
        className="mb-2"
        onClick={() => setAddExpenseOpen(true)}
        size={collapsed ? "icon" : "lg"}
        title={collapsed ? "Add Expense" : undefined}
      >
        {collapsed ? <Plus className="h-4 w-4" /> : "+ Add Expense"}
      </Button>
      <VoiceEntryButton
        categories={categories}
        className={cn(
          "mb-4 flex h-9 items-center justify-center gap-2 rounded-lg border border-input text-sm text-muted-foreground hover:bg-accent",
          collapsed ? "w-9" : "w-full",
        )}
        currentMemberId={currentMemberId}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
      />

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          if (!item.enabled) {
            return (
              <div
                aria-disabled="true"
                className={cn(
                  "flex cursor-default items-center gap-3 px-3 py-2 text-sm text-muted-foreground",
                  collapsed && "justify-center px-0",
                )}
                key={item.href}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4" />
                {!collapsed && item.label}
              </div>
            );
          }
          const active = pathname.startsWith(item.href);
          return (
            <Link
              className={cn(
                "relative flex items-center gap-3 rounded-r-lg border-l-3 px-3 py-2 text-sm transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:bg-accent",
              )}
              href={item.href}
              key={item.href}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && item.label}
              {item.href === "/notifications" && unreadNotifications > 0 && (
                <span
                  className={cn(
                    "rounded-full bg-destructive font-medium text-white",
                    collapsed
                      ? "absolute top-1 right-4 h-2 w-2"
                      : "ml-auto px-1.5 py-0.5 text-xs",
                  )}
                >
                  {!collapsed && unreadNotifications}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-1 border-t pt-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-accent",
                collapsed && "justify-center",
              )}
              title={collapsed ? realMemberName : undefined}
              type="button"
            >
              <Avatar className="size-8" size="sm">
                {realMember?.image && (
                  <AvatarImage alt={realMemberName} src={realMember.image} />
                )}
                <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                  {realMemberName.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">
                      {realMemberName}
                    </p>
                    <p className="text-xs text-muted-foreground">Account</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onClick={() => logoutAction()}
              variant="destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddExpenseModal
        categories={categories}
        currentMemberId={currentMemberId}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        onOpenChange={setAddExpenseOpen}
        open={addExpenseOpen}
      />
    </aside>
  );
}
