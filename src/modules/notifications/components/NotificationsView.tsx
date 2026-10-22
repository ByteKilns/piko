"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import type { NotificationCategory, NotificationPreferences } from "@/lib/notification-preferences-cookie";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  setNotificationPreferencesAction,
} from "@/modules/notifications/api/notifications.actions";

export type NotificationRowModel = {
  body: string;
  category: NotificationCategory;
  dayLabel: string;
  id: string;
  read: boolean;
  time: string;
  title: string;
};

export type UpcomingPaymentModel = { amount: number; dueLabel: string; groupName: string; id: string; name: string; ownerLabel: string };

type LedgerFigures = { budgetAlerts: number; resolved: number; unread: number; upcomingCount: number };

type Props = {
  ledger: LedgerFigures;
  notifications: NotificationRowModel[];
  preferences: NotificationPreferences;
  upcoming: UpcomingPaymentModel[];
};

type Tab = "alerts" | "all" | "unread";

const CATEGORY_LABEL: Record<NotificationCategory, string> = { budget: "Budget", goal: "Goal", payment: "Payment", shared: "Shared" };
const PREF_ORDER: NotificationCategory[] = ["budget", "goal", "payment", "shared"];

export function NotificationsView(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [preferences, setPreferences] = useState(props.preferences);

  const enabled = props.notifications.filter((n) => preferences[n.category]);
  const counts = {
    alerts: enabled.filter((n) => n.category === "budget").length,
    all: enabled.length,
    unread: enabled.filter((n) => !n.read).length,
  };
  const visible = enabled.filter((n) => (tab === "unread" ? !n.read : tab === "alerts" ? n.category === "budget" : true));

  const days = [...new Set(visible.map((n) => n.dayLabel))];

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function togglePreference(category: NotificationCategory) {
    const next = { ...preferences, [category]: !preferences[category] };
    setPreferences(next);
    void run(() => setNotificationPreferencesAction(next), "Preferences saved");
  }

  return (
    <div>
      <PageHeader
        actions={
          <Button disabled={counts.unread === 0} onClick={() => void run(() => markAllNotificationsReadAction(), "All marked read")} variant="ghost">
            Mark all read
          </Button>
        }
        title="Notifications"
      />

      <Ledger data-tour="notifications-ledger">
        <LedgerCell label="Unread" lead note="Need your attention">
          <span className="text-[40px] leading-none font-extrabold tracking-[-0.025em] tabular-nums">{props.ledger.unread}</span>
        </LedgerCell>
        <LedgerCell label="Upcoming payments" note="Next 7 days">
          <span className="text-2xl leading-none font-semibold tabular-nums">{props.ledger.upcomingCount}</span>
        </LedgerCell>
        <LedgerCell label="Budget alerts" note="Over threshold">
          <span className="text-2xl leading-none font-semibold tabular-nums">{props.ledger.budgetAlerts}</span>
        </LedgerCell>
        <LedgerCell label="Resolved this month" note="Read">
          <span className="text-2xl leading-none font-semibold tabular-nums">{props.ledger.resolved}</span>
        </LedgerCell>
      </Ledger>

      <LineTabs
        className="mt-5.5"
        label="Filter"
        onChange={(value) => setTab(value)}
        tabs={[
          { count: counts.all, label: "All", value: "all" },
          { count: counts.unread, label: "Unread", value: "unread" },
          { count: counts.alerts, label: "Alerts", value: "alerts" },
        ]}
        value={tab}
      />

      {days.map((dayLabel) => (
        <div key={dayLabel}>
          <div className="border-b border-rule px-2 pt-6 pb-2 text-[13px] font-semibold text-n-600">{dayLabel}</div>
          {visible
            .filter((n) => n.dayLabel === dayLabel)
            .map((notification) => (
              <div className="grid grid-cols-[10px_minmax(0,1fr)_auto_auto] items-baseline gap-4 border-b border-n-300 px-2 py-3.5" key={notification.id}>
                <span className={cn("size-2.5 translate-y-0.5", notification.read ? "bg-transparent shadow-[inset_0_0_0_1px_var(--n-400)]" : "bg-signal")} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn("text-[15px]", !notification.read && "font-semibold")}>{notification.title}</span>
                  <span className="text-[13px] text-n-700">{notification.body}</span>
                </div>
                <span className="text-xs whitespace-nowrap text-n-600">{CATEGORY_LABEL[notification.category]}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs whitespace-nowrap text-n-600">{notification.time}</span>
                  {!notification.read && (
                    <Button
                      className="h-auto px-1.5 py-0.5 text-[13px]"
                      onClick={() => void run(() => markNotificationReadAction(notification.id), "Marked read")}
                      type="button"
                      variant="ghost"
                    >
                      Mark read
                    </Button>
                  )}
                </span>
              </div>
            ))}
        </div>
      ))}

      {visible.length === 0 && <div className="border-b border-n-300 px-2 py-9 text-sm text-n-700">Nothing here.</div>}

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-12" data-tour="notifications-list">
        <section className="min-w-0">
          <SectionHeading>Coming up</SectionHeading>
          {props.upcoming.length === 0 ? (
            <p className="pt-4 text-sm text-n-600">Nothing due in the next 7 days.</p>
          ) : (
            props.upcoming.map((payment) => (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-n-300 py-3" key={payment.id}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px]">{payment.name}</span>
                  <span className="text-[13px] text-n-600">
                    {payment.ownerLabel} · {payment.dueLabel}
                  </span>
                </span>
                <span className="text-[15px]">
                  <Money value={payment.amount} />
                </span>
              </div>
            ))
          )}
        </section>

        <section className="min-w-0">
          <SectionHeading>What to notify about</SectionHeading>
          <div className="flex flex-col pt-1">
            {PREF_ORDER.map((category) => (
              <label className="flex items-center justify-between gap-4 border-b border-n-300 py-3.5 text-[15px]" key={category}>
                {CATEGORY_LABEL[category]}
                <input checked={preferences[category]} onChange={() => togglePreference(category)} type="checkbox" />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
