"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

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

// Sidebar motion option "1a — Subtle & polished": the highlights travel, the
// rest is a quick ease-out. Constants mirror the mockup exactly.
const OUT = "cubic-bezier(.2,.8,.2,1)";
const WIDTH_TRANSITION = `width 260ms ${OUT}`;
const INDICATOR_TRANSITION = `transform 280ms ${OUT}, opacity 200ms ease`;
const HOVER_TRANSITION = `transform 180ms ${OUT}, opacity 150ms ease`;
const HOVER_FADE = "opacity 150ms ease";
const TIP_TRANSITION = `top 160ms ${OUT}, opacity 150ms ease, transform 150ms ${OUT}`;
const ENTER_DURATION = 320;
const ENTER_STAGGER = 22;
const ENTER_DELAY = 60;

function labelTransition(delay: string): string {
  return `opacity 150ms ease-out ${delay}, transform 220ms ${OUT} ${delay}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function NavLink({
  active,
  badge,
  collapsed,
  item,
  labelDelay,
  onBlur,
  onEnter,
  onRowLeave,
  registerRef,
}: {
  active: boolean;
  badge?: number;
  collapsed: boolean;
  item: NavItem;
  labelDelay: string;
  onBlur: () => void;
  onEnter: (item: NavItem, el: HTMLAnchorElement) => void;
  onRowLeave: () => void;
  registerRef: (href: string, el: HTMLAnchorElement | null) => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center text-sm transition-[color,transform] duration-[160ms,120ms] ease-out active:scale-[0.985]",
        active ? "font-semibold text-ink" : "text-n-800 hover:text-ink",
        collapsed ? "gap-0 px-0 justify-center" : "gap-3 px-2.5",
      )}
      data-enter=""
      href={item.href}
      onBlur={onBlur}
      onFocus={(event) => onEnter(item, event.currentTarget)}
      onMouseEnter={(event) => onEnter(item, event.currentTarget)}
      onMouseLeave={onRowLeave}
      ref={(el) => registerRef(item.href, el)}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span
        className={cn("overflow-hidden whitespace-nowrap", collapsed ? "w-0 flex-none opacity-0 -translate-x-1" : "min-w-0 flex-1 truncate opacity-100 translate-x-0")}
        style={{ transition: labelTransition(labelDelay) }}
      >
        {item.label}
      </span>
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
  const [logoHover, setLogoHover] = useState(false);
  const [tip, setTip] = useState({ label: "", left: 0, on: false, top: 0 });
  const openAddExpense = useCallback(() => setAddExpenseOpen(true), []);
  useAddExpenseShortcut(openAddExpense);

  const asideRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const placedRef = useRef(false);
  const tipTimer = useRef<number | null>(null);

  const me = members.find((m) => m.id === currentMemberId);
  const myName = me?.name ?? "Me";
  const expenseMembers = members.map((m) => ({ id: m.id, name: m.name }));

  const allItems = [...NAV_GROUPS.flatMap((group) => group.items), ...NAV_FOOTER];
  const activeHref = allItems.find((item) => isActivePath(pathname, item.href))?.href ?? null;
  const labelDelay = collapsed ? "0ms" : "70ms";

  const registerRef = useCallback((href: string, el: HTMLAnchorElement | null) => {
    if (el) linkRefs.current.set(href, el);
    else linkRefs.current.delete(href);
  }, []);

  // Slide the active indicator to its row. The very first placement is instant.
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator) return;
    const el = activeHref ? linkRefs.current.get(activeHref) : null;
    if (!el) {
      indicator.style.opacity = "0";
      return;
    }
    const y = el.offsetTop;
    if (!placedRef.current) {
      indicator.style.transition = "none";
      indicator.style.transform = `translateY(${y}px)`;
      void indicator.offsetHeight;
      indicator.style.transition = INDICATOR_TRANSITION;
      placedRef.current = true;
      if (prefersReducedMotion()) indicator.style.opacity = "1";
    } else {
      indicator.style.transform = `translateY(${y}px)`;
    }
  }, [activeHref, collapsed]);

  // Entrance: fade each block in with a 6px rise, then reveal the indicator.
  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const indicator = indicatorRef.current;
    if (prefersReducedMotion()) {
      if (indicator) indicator.style.opacity = "1";
      return;
    }
    const blocks = Array.from(aside.querySelectorAll<HTMLElement>("[data-enter]"));
    blocks.forEach((el, index) => {
      el.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { delay: ENTER_DELAY + index * ENTER_STAGGER, duration: ENTER_DURATION, easing: OUT, fill: "backwards" },
      );
    });
    const timer = window.setTimeout(() => {
      if (indicator) indicator.style.opacity = "1";
    }, ENTER_DELAY + blocks.length * ENTER_STAGGER);
    return () => window.clearTimeout(timer);
  }, []);

  function showHover(el: HTMLElement) {
    const hover = hoverRef.current;
    if (!hover) return;
    const visible = hover.style.opacity === "1";
    hover.style.transition = visible && !prefersReducedMotion() ? HOVER_TRANSITION : HOVER_FADE;
    hover.style.transform = `translateY(${el.offsetTop}px)`;
    hover.style.opacity = "1";
  }

  function hideHover() {
    const hover = hoverRef.current;
    if (!hover) return;
    hover.style.transition = HOVER_FADE;
    hover.style.opacity = "0";
  }

  function showTip(label: string, el: HTMLElement) {
    const aside = asideRef.current;
    if (!aside) return;
    const row = el.getBoundingClientRect();
    const box = aside.getBoundingClientRect();
    setTip({ label, left: box.right + 8, on: true, top: row.top + row.height / 2 });
  }

  function hideTip() {
    setTip((prev) => (prev.on ? { ...prev, on: false } : prev));
  }

  function handleEnter(item: NavItem, el: HTMLAnchorElement) {
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    showHover(el);
    if (collapsed) showTip(item.label, el);
  }

  // Moving between rows keeps the hover tint; only the tooltip hides (after a
  // short delay so it doesn't flicker).
  function rowLeave() {
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(hideTip, 70);
  }

  function handleNavLeave() {
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    hideHover();
    hideTip();
  }

  function handleBlur() {
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    hideTip();
  }

  function toggleCollapsed() {
    const next = !collapsed;
    if (!next) hideTip();
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE_NAME}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col gap-5.5 overflow-y-auto border-r-2 border-rule bg-paper pt-5 pb-4.5 text-ink md:flex",
        collapsed ? "w-16 px-2" : "w-61 px-3.5",
      )}
      data-motion-root=""
      ref={asideRef}
      style={{ transition: WIDTH_TRANSITION }}
    >
      <div className={cn("flex items-center gap-2.5 px-1", collapsed && "flex-col gap-2 px-0")} data-enter="">
        <span
          aria-hidden
          className="relative grid size-8 shrink-0 place-items-center bg-ink text-base font-extrabold text-paper"
          onMouseEnter={() => setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
        >
          <span style={{ opacity: collapsed && logoHover ? 0 : 1, transition: "opacity 160ms ease" }}>P</span>
          <svg
            aria-hidden
            className="absolute size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            style={{ opacity: collapsed && logoHover ? 1 : 0, transition: "opacity 160ms ease" }}
            viewBox="0 0 24 24"
          >
            <path d="M3 3h18v18H3zM9 3v18" />
          </svg>
        </span>
        <div
          className={cn(
            "flex flex-col overflow-hidden",
            collapsed ? "h-0 w-0 flex-none opacity-0 -translate-x-1" : "min-w-0 flex-1 opacity-100 translate-x-0",
          )}
          style={{ transition: labelTransition(labelDelay) }}
        >
          <span className="text-[17px] leading-tight font-extrabold">Piko</span>
          <span className="text-xs leading-[1.3] text-n-600">Plan together, grow together</span>
        </div>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-7 shrink-0 place-items-center text-n-600 hover:bg-ink/7 hover:text-ink"
          onClick={toggleCollapsed}
          style={{ transition: `opacity 150ms ease-out ${labelDelay}, background-color 160ms ease, color 160ms ease` }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {collapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.75} /> : <PanelLeftClose className="size-4" strokeWidth={1.75} />}
        </button>
      </div>

      <div className={cn("flex gap-1.5", collapsed && "flex-col items-center")} data-enter="">
        <Button
          className={cn("h-10 min-w-0 flex-1 justify-start", collapsed && "w-10 flex-none justify-center px-0")}
          onClick={openAddExpense}
          title="Add expense (N)"
          type="button"
        >
          <Plus />
          <span
            className={cn("overflow-hidden whitespace-nowrap", collapsed ? "w-0 flex-none opacity-0" : "opacity-100")}
            style={{ transition: `opacity 150ms ease-out ${labelDelay}` }}
          >
            Add expense
          </span>
        </Button>
        <VoiceEntryButton
          categories={categories}
          className="grid size-10 shrink-0 place-items-center border border-ink text-ink hover:bg-ink/6"
          currentMemberId={currentMemberId}
          members={expenseMembers}
          quickCategoryIds={quickCategoryIds}
        />
      </div>

      <nav aria-label="Main" className="relative flex flex-1 flex-col gap-4.5" onMouseLeave={handleNavLeave}>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-surface opacity-0"
          ref={indicatorRef}
        >
          <span className="absolute inset-y-0 left-0 w-0.75 bg-signal" />
        </span>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-ink/6 opacity-0" ref={hoverRef} />

        {NAV_GROUPS.map((group) => (
          <div className="flex flex-col gap-px" key={group.label}>
            {collapsed ? (
              <span aria-hidden className="mx-auto mb-1.5 h-px w-6 bg-n-300" data-enter="" />
            ) : (
              <span className="micro-label px-2.5 pb-1.5 font-normal text-n-600" data-enter="">
                {group.label}
              </span>
            )}
            {group.items.map((item) => (
              <NavLink
                active={item.href === activeHref}
                collapsed={collapsed}
                item={item}
                key={item.href}
                labelDelay={labelDelay}
                onBlur={handleBlur}
                onEnter={handleEnter}
                onRowLeave={rowLeave}
                registerRef={registerRef}
              />
            ))}
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-px border-t border-n-300 pt-3.5">
          {NAV_FOOTER.map((item) => (
            <NavLink
              active={item.href === activeHref}
              badge={item.href === "/notifications" ? unreadNotifications : undefined}
              collapsed={collapsed}
              item={item}
              key={item.href}
              labelDelay={labelDelay}
              onBlur={handleBlur}
              onEnter={handleEnter}
              onRowLeave={rowLeave}
              registerRef={registerRef}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Account menu for ${myName}`}
                className={cn("mt-1.5 flex h-10 items-center gap-2.5 px-2.5 text-left hover:bg-ink/6", collapsed && "justify-center gap-0 px-0")}
                data-enter=""
                type="button"
              >
                <Avatar className="size-5.5" size="sm">
                  {me?.image && <AvatarImage alt="" src={me.image} />}
                  <AvatarFallback className="bg-ink text-[11px] font-semibold text-paper">{myName.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap text-sm font-semibold",
                    collapsed ? "w-0 flex-none opacity-0" : "min-w-0 flex-1 truncate opacity-100",
                  )}
                  style={{ transition: `opacity 150ms ease-out ${labelDelay}` }}
                >
                  {myName}
                </span>
                {!collapsed && <ChevronsUpDown className="size-3.5 shrink-0 text-n-600" />}
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

      <span
        aria-hidden
        className="pointer-events-none fixed z-50 bg-ink px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-paper"
        style={{
          left: tip.left,
          opacity: tip.on ? 1 : 0,
          top: tip.top,
          transform: `translate(${tip.on ? 0 : -4}px, -50%)`,
          transition: TIP_TRANSITION,
        }}
      >
        {tip.label}
      </span>

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
