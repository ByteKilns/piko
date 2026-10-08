"use client";

import { useCallback, useState } from "react";

import { ChevronsUpDown, LogOut, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, NAV_FOOTER, NAV_GROUPS, type NavItem } from "@/components/nav/nav-items";
import { useAddExpenseShortcut } from "@/components/nav/useAddExpenseShortcut";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { cn } from "@/lib/utils";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";

type Category = { groupName: string; id: string; name: string };
type Member = { id: string; image: null | string; name: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  initialCollapsed: boolean;
  members: Member[];
  quickCategoryIds: string[];
  unreadNotifications: number;
};

function NavLink({ badge, collapsed, item, pathname }: { badge?: number; collapsed: boolean; item: NavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-3 px-2.5 text-sm transition-colors hover:bg-ink/6 hover:text-ink",
        active ? "bg-surface font-semibold text-ink" : "text-n-800",
        collapsed && "justify-center px-0",
      )}
      href={item.href}
      title={collapsed ? item.label : undefined}
    >
      {active && <span aria-hidden className="absolute inset-y-0 left-0 w-0.75 bg-signal" />}
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="flex-1 truncate">{item.label}</span>}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "grid h-4.5 min-w-4.5 place-items-center bg-signal px-1 text-[11px] font-semibold text-paper",
            collapsed && "absolute top-0.5 right-1",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function SidebarNav({ categories, currentMemberId, initialCollapsed, members, quickCategoryIds, unreadNotifications }: Props) {
  const pathname = usePathname();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const openAddExpense = useCallback(() => setAddExpenseOpen(true), []);
  useAddExpenseShortcut(openAddExpense);

  const me = members.find((m) => m.id === currentMemberId);
  const myName = me?.name ?? "Me";
  const expenseMembers = members.map((m) => ({ id: m.id, name: m.name }));

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
        "sticky top-0 hidden h-screen shrink-0 flex-col gap-5.5 overflow-y-auto border-r-2 border-rule bg-paper pt-5 pb-4.5 text-ink md:flex",
        collapsed ? "w-16 px-2" : "w-61 px-3.5",
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-1", collapsed && "flex-col px-0")}>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center bg-ink text-base font-extrabold text-paper">
          P
        </span>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[17px] leading-tight font-extrabold">Piko</span>
            <span className="text-xs leading-[1.3] text-n-600">Plan together, grow together</span>
          </div>
        )}
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-7 shrink-0 place-items-center text-n-600 hover:bg-ink/7 hover:text-ink"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {collapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.75} /> : <PanelLeftClose className="size-4" strokeWidth={1.75} />}
        </button>
      </div>

      <div className={cn("flex gap-1.5", collapsed && "flex-col items-center")}>
        <Button
          className={cn("h-10 min-w-0 flex-1 justify-start", collapsed && "w-10 flex-none justify-center px-0")}
          onClick={openAddExpense}
          title="Add expense (N)"
          type="button"
        >
          <Plus />
          {collapsed ? <span className="sr-only">Add expense</span> : "Add expense"}
        </Button>
        <VoiceEntryButton
          categories={categories}
          className="grid size-10 shrink-0 place-items-center border border-ink text-ink hover:bg-ink/6"
          currentMemberId={currentMemberId}
          members={expenseMembers}
          quickCategoryIds={quickCategoryIds}
        />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-4.5">
        {NAV_GROUPS.map((group) => (
          <div className="flex flex-col gap-px" key={group.label}>
            {collapsed ? (
              <span aria-hidden className="mx-auto mb-1.5 h-px w-6 bg-n-300" />
            ) : (
              <span className="micro-label px-2.5 pb-1.5 font-normal text-n-600">{group.label}</span>
            )}
            {group.items.map((item) => (
              <NavLink collapsed={collapsed} item={item} key={item.href} pathname={pathname} />
            ))}
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-px border-t border-n-300 pt-3.5">
          {NAV_FOOTER.map((item) => (
            <NavLink
              badge={item.href === "/notifications" ? unreadNotifications : undefined}
              collapsed={collapsed}
              item={item}
              key={item.href}
              pathname={pathname}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Account menu for ${myName}`}
                className={cn("mt-1.5 flex h-10 items-center gap-2.5 px-2.5 text-left hover:bg-ink/6", collapsed && "justify-center px-0")}
                type="button"
              >
                <Avatar className="size-5.5" size="sm">
                  {me?.image && <AvatarImage alt="" src={me.image} />}
                  <AvatarFallback className="bg-ink text-[11px] font-semibold text-paper">{myName.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{myName}</span>
                    <ChevronsUpDown className="size-3.5 text-n-600" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" side="top">
              <DropdownMenuItem onClick={() => logoutAction()} variant="destructive">
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <ExpenseDialog
        categories={categories}
        currentMemberId={currentMemberId}
        members={expenseMembers}
        onOpenChange={setAddExpenseOpen}
        open={addExpenseOpen}
        quickCategoryIds={quickCategoryIds}
      />
    </aside>
  );
}
