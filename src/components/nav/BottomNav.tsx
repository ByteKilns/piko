"use client";

import { useEffect, useRef, useState } from "react";

import { MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BOTTOM_BAR, isActivePath, MORE_GROUPS } from "@/components/nav/nav-items";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";

type Category = { groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  members: Member[];
  quickCategoryIds: string[];
  unreadNotifications: number;
};

const BAR_ITEM = "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]";

export function BottomNav({ categories, currentMemberId, members, quickCategoryIds, unreadNotifications }: Props) {
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
  const moreActive = MORE_GROUPS.some((group) => group.items.some((item) => isActivePath(pathname, item.href)));

  return (
    <>
      <button
        aria-label="Add expense"
        className={cn(
          "fixed right-4 bottom-20 z-10 grid size-12 place-items-center bg-signal-fill text-white shadow-dialog transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        data-tour="add-expense-mobile"
        onClick={() => setAddExpenseOpen(true)}
        type="button"
      >
        <Plus className="size-6" />
      </button>
      <VoiceEntryButton
        categories={categories}
        className={cn(
          "fixed right-4 bottom-36 z-10 grid size-11 place-items-center border border-ink bg-paper text-ink shadow-menu transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        currentMemberId={currentMemberId}
        members={members}
        quickCategoryIds={quickCategoryIds}
      />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t-2 border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
        data-tour="nav-bottom"
      >
        {BOTTOM_BAR.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(BAR_ITEM, active ? "font-semibold text-ink" : "text-n-600")}
              href={item.href}
              key={item.href}
            >
              {active && <span aria-hidden className="absolute inset-x-3 -top-0.5 h-0.5 bg-signal" />}
              <Icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
        <button className={cn(BAR_ITEM, moreActive ? "font-semibold text-ink" : "text-n-600")} onClick={() => setMoreOpen(true)} type="button">
          {moreActive && <span aria-hidden className="absolute inset-x-3 -top-0.5 h-0.5 bg-signal" />}
          <MoreHorizontal className="size-5" strokeWidth={1.75} />
          More
          {unreadNotifications > 0 && <span aria-hidden className="absolute top-1.5 right-[calc(50%-16px)] size-2 bg-signal" />}
        </button>
      </nav>

      <Sheet onOpenChange={setMoreOpen} open={moreOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
            {MORE_GROUPS.map((group) => (
              <div className="flex flex-col" key={group.label}>
                <span className="micro-label pb-1.5 font-normal text-n-600">{group.label}</span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn("flex h-11 items-center gap-3 border-b border-n-300 px-1 text-[15px]", active ? "font-semibold text-ink" : "text-n-800")}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMoreOpen(false)}
                    >
                      <Icon className="size-4" strokeWidth={1.75} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/notifications" && unreadNotifications > 0 && (
                        <span className="grid h-4.5 min-w-4.5 place-items-center bg-signal px-1 text-[11px] font-semibold text-paper">
                          {unreadNotifications}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <ExpenseDialog
        categories={categories}
        currentMemberId={currentMemberId}
        members={members}
        onOpenChange={setAddExpenseOpen}
        open={addExpenseOpen}
        quickCategoryIds={quickCategoryIds}
      />
    </>
  );
}
