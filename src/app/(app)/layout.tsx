import { cookies } from "next/headers";

import { BottomNav } from "@/components/nav/BottomNav";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { listCategories } from "@/modules/categories/api/categories";
import { countUnreadNotifications } from "@/modules/notifications/api/notifications.actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentMember();
  const [members, categories, unreadNotifications, cookieStore] = await Promise.all([
    getHouseholdMembers(current.householdId),
    listCategories(current.householdId),
    countUnreadNotifications(current.householdId),
    cookies(),
  ]);

  const expenseCategories = categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }));
  const expenseMembers = members.map((m) => ({ id: m.id, name: m.user.name }));
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE_NAME)?.value === "true";

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <SidebarNav
        categories={expenseCategories}
        currentMemberId={current.memberId}
        initialCollapsed={initialCollapsed}
        members={members.map((m) => ({ id: m.id, image: m.user.image, name: m.user.name }))}
        unreadNotifications={unreadNotifications}
      />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-12 md:pt-9 md:pb-16">
        {/* @container: composites lay out against the content width, not the window.
            space-y-6 spaces the pages not yet redesigned (each redesigned page renders
            a single root element); removed in phase 6. */}
        <div className="@container max-w-280 space-y-6">{children}</div>
      </main>
      <BottomNav
        categories={expenseCategories}
        currentMemberId={current.memberId}
        members={expenseMembers}
        unreadNotifications={unreadNotifications}
      />
    </div>
  );
}
