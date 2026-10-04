"use client";

import { useEffect, useRef, useState } from "react";

import {
  BarChart3,
  Bell,
  HandCoins,
  History,
  Home,
  List,
  type LucideIcon,
  MoreHorizontal,
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

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AddExpenseModal } from "@/modules/expenses/components/AddExpenseModal";
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

// The rest of the desktop sidebar's routes — not frequent enough for a
// bottom-bar slot, but still need to be reachable on mobile.
const MORE_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/savings-goals", label: "Savings Goals", icon: PiggyBank },
  { href: "/loans", label: "Loans", icon: HandCoins },
  { href: "/dhuku", label: "Dhuku", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/categories", label: "Categories", icon: List },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/activity", label: "Activity", icon: History },
];

type Category = { groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  members: Member[];
  unreadNotifications: number;
};

export function BottomNav({ categories, currentMemberId, members, unreadNotifications }: Props) {
  const pathname = usePathname();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabsHidden, setFabsHidden] = useState(false);
  const lastScrollY = useRef(0);
  // Accumulated upward movement since the last downward tick — requiring a
  // deliberate scroll-up (not just settling after a downward flick) before
  // the buttons reappear over list content avoids them popping back in on
  // every tiny wobble and immediately covering whatever is underneath.
  const upDistance = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      if (delta > 0) {
        upDistance.current = 0;
        if (y > 80) setFabsHidden(true);
      } else {
        upDistance.current += -delta;
        // Near the top there's nothing left for the buttons to cover, so
        // show them immediately rather than waiting for the distance check.
        if (y <= 80 || upDistance.current > 60) setFabsHidden(false);
      }
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fabHiddenClass = fabsHidden ? "pointer-events-none translate-y-16 opacity-0" : "";

  return (
    <>
      <button
        aria-label="Add Expense"
        className={cn(
          "fixed right-4 bottom-20 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        onClick={() => setAddExpenseOpen(true)}
        type="button"
      >
        <Plus className="h-6 w-6" />
      </button>
      <VoiceEntryButton
        categories={categories}
        className={cn(
          "fixed right-4 bottom-36 z-10 flex h-11 w-11 items-center justify-center rounded-full border bg-background text-foreground shadow-lg transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        currentMemberId={currentMemberId}
        members={members}
      />

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background md:hidden">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
                active ? "font-semibold text-primary" : "text-muted-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          className={cn(
            "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
            MORE_ITEMS.some((item) => pathname.startsWith(item.href)) ? "font-semibold text-primary" : "text-muted-foreground",
          )}
          onClick={() => setMoreOpen(true)}
          type="button"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-[calc(50%-18px)] h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>
      </nav>

      <Sheet onOpenChange={setMoreOpen} open={moreOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col overflow-y-auto p-2">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    active ? "font-medium text-primary" : "text-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.href === "/notifications" && unreadNotifications > 0 && (
                    <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-xs font-medium text-white">
                      {unreadNotifications}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <AddExpenseModal
        categories={categories}
        currentMemberId={currentMemberId}
        members={members}
        onOpenChange={setAddExpenseOpen}
        open={addExpenseOpen}
      />
    </>
  );
}
