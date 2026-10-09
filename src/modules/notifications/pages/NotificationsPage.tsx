import { cookies } from "next/headers";

import { formatShortDate } from "@/lib/date-format";
import { type DateFormat, getDateFormatPref } from "@/lib/date-format-cookie";
import { NOTIFICATION_PREFS_COOKIE_NAME, parseNotificationPreferences } from "@/lib/notification-preferences-cookie";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import {
  listNotifications,
  syncDhukuDueSoonNotifications,
  syncDueSoonNotifications,
  syncLoanInstallmentsDueSoonNotifications,
} from "@/modules/notifications/api/notifications.actions";
import { type NotificationRowModel, NotificationsView, type UpcomingPaymentModel } from "@/modules/notifications/components/NotificationsView";
import { formatNotificationTime } from "@/modules/notifications/lib/notification-format";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";

function displayLabel(role: "me" | "partner" | "shared", name: string): string {
  if (role === "shared") return "Shared";
  if (role === "me") return "Me";
  return name;
}

function dayLabelFor(createdAt: Date, dateFormat: DateFormat): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(createdAt);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatShortDate(createdAt.toISOString().slice(0, 10), dateFormat);
}

export async function NotificationsPage() {
  const { householdId, memberId } = await getCurrentMember();

  await Promise.all([
    syncDueSoonNotifications(householdId),
    syncLoanInstallmentsDueSoonNotifications(householdId),
    syncDhukuDueSoonNotifications(householdId),
  ]);

  const [members, categories, notificationRows, recurringItems, cookieStore, dateFormat] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listNotifications(householdId),
    listRecurringExpenses(householdId),
    cookies(),
    getDateFormatPref(householdId),
  ]);

  const preferences = parseNotificationPreferences(cookieStore.get(NOTIFICATION_PREFS_COOKIE_NAME)?.value);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const rows: NotificationRowModel[] = notificationRows.map((n) => ({
    body: n.body,
    category: n.category,
    dayLabel: dayLabelFor(n.createdAt, dateFormat),
    id: n.id,
    read: n.readAt !== null,
    time: formatNotificationTime(n.createdAt, dateFormat),
    title: n.title,
  }));

  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming: UpcomingPaymentModel[] = recurringItems
    .filter((item) => item.status === "active")
    .filter((item) => {
      const due = new Date(`${item.nextDueDate}T00:00:00`);
      return due >= startOfToday && due <= in7Days;
    })
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .map((item) => {
      const owner = item.ownerMemberId ? memberById.get(item.ownerMemberId) : null;
      return {
        amount: Number(item.amount),
        dueLabel: formatShortDate(item.nextDueDate, dateFormat),
        groupName: categoryById.get(item.categoryId)?.groupName ?? "Other",
        id: item.id,
        name: item.name,
        ownerLabel: displayLabel(roleForOwner(item.ownerMemberId, memberId), owner?.user.name ?? "Partner"),
      };
    });

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const resolvedThisMonth = notificationRows.filter((n) => n.readAt !== null && n.readAt >= monthStart).length;

  return (
    <NotificationsView
      ledger={{
        budgetAlerts: rows.filter((r) => r.category === "budget").length,
        resolved: resolvedThisMonth,
        unread: rows.filter((r) => !r.read).length,
        upcomingCount: upcoming.length,
      }}
      notifications={rows}
      preferences={preferences}
      upcoming={upcoming}
    />
  );
}
