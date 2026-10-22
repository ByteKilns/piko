import { cookies } from "next/headers";

import { BottomNav } from "@/components/nav/BottomNav";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { SIDEBAR_COLLAPSED_COOKIE_NAME, SIDEBAR_NARROW_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { todayISO } from "@/lib/today";
import { listCategories } from "@/modules/categories/api/categories";
import { getDemoExpiry } from "@/modules/demo/api/demo";
import { DemoBanner } from "@/modules/demo/components/DemoBanner";
import { DemoPhone } from "@/modules/demo/components/DemoPhone";
import { DemoProvider } from "@/modules/demo/components/DemoProvider";
import { demoTimeLeft } from "@/modules/demo/lib/demo-constants";
import { listRecentExpensesForHousehold } from "@/modules/expenses/api/expenses";
import { topCategoryIds } from "@/modules/expenses/lib/expense-view";
import { buildRecentGroups } from "@/modules/expenses/lib/recent-groups";
import { countUnreadNotifications } from "@/modules/notifications/api/notifications";

// How many recent expenses decide the quick-pick categories in Add expense.
const QUICK_CATEGORY_SAMPLE = 60;
// How many the demo's phone lists, as many as the mobile app does.
const PHONE_RECENT = 20;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentMember();
  const [members, categories, unreadNotifications, recentExpenses, cookieStore, demoExpiresAt, dateFormat] = await Promise.all([
    getHouseholdMembers(current.householdId),
    listCategories(current.householdId),
    countUnreadNotifications(current.householdId),
    listRecentExpensesForHousehold(current.householdId, QUICK_CATEGORY_SAMPLE),
    cookies(),
    current.isDemo ? getDemoExpiry(current.householdId) : null,
    current.isDemo ? getDateFormatPref(current.householdId) : null,
  ]);

  const expenseCategories = categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }));
  const expenseMembers = members.map((m) => ({ id: m.id, name: m.user.name }));
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE_NAME)?.value === "true";
  const initialNarrow = cookieStore.get(SIDEBAR_NARROW_COOKIE_NAME)?.value === "true";
  const quickCategoryIds = topCategoryIds(recentExpenses, 5);
  const demo = demoExpiresAt ? { timeLeft: demoTimeLeft(demoExpiresAt, new Date()) } : null;
  const phoneRecent =
    demo && dateFormat ? buildRecentGroups(recentExpenses.slice(0, PHONE_RECENT), categories, { dateFormat, today: todayISO() }) : [];

  return (
    <DemoProvider demo={demo}>
      <div className="flex min-h-screen bg-paper text-ink">
        <SidebarNav
          categories={expenseCategories}
          currentMemberId={current.memberId}
          initialCollapsed={initialCollapsed}
          initialNarrow={initialNarrow}
          members={members.map((m) => ({ id: m.id, image: m.user.image, name: m.user.name }))}
          quickCategoryIds={quickCategoryIds}
          unreadNotifications={unreadNotifications}
        />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-12 md:pt-9 md:pb-16">
          <DemoBanner />
          {/* @container: composites lay out against the content width, not the window.
              Capped at 1280px and centred in the space beside the sidebar (the sidebar
              isn't part of the centring), so a wide monitor gets even margins. */}
          <div className="@container mx-auto max-w-320">{children}</div>
        </main>
        {demo && (
          <DemoPhone
            categories={expenseCategories}
            currentMemberId={current.memberId}
            members={expenseMembers}
            quickCategoryIds={quickCategoryIds}
            recent={phoneRecent}
          />
        )}
        <BottomNav
          categories={expenseCategories}
          currentMemberId={current.memberId}
          members={expenseMembers}
          quickCategoryIds={quickCategoryIds}
          unreadNotifications={unreadNotifications}
        />
      </div>
    </DemoProvider>
  );
}
