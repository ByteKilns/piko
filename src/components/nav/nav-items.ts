import {
  BarChart3,
  Bell,
  HandCoins,
  History,
  Home,
  List,
  type LucideIcon,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = { href: string; icon: LucideIcon; label: string };
export type NavGroup = { items: NavItem[]; label: string };

const HOME: NavItem = { href: "/dashboard", icon: Home, label: "Home" };
const EXPENSES: NavItem = { href: "/expenses", icon: Receipt, label: "Expenses" };
const BUDGET: NavItem = { href: "/budget", icon: Wallet, label: "Budget" };
const RECURRING: NavItem = { href: "/recurring", icon: Repeat, label: "Recurring" };
const SAVINGS: NavItem = { href: "/savings", icon: PiggyBank, label: "Savings" };
const LOANS: NavItem = { href: "/loans", icon: HandCoins, label: "Loans" };
const DHUKU: NavItem = { href: "/dhuku", icon: Users, label: "Dhuku" };
const REPORTS: NavItem = { href: "/reports", icon: BarChart3, label: "Reports" };
const CATEGORIES: NavItem = { href: "/categories", icon: List, label: "Categories" };
const NOTIFICATIONS: NavItem = { href: "/notifications", icon: Bell, label: "Notifications" };
const ACTIVITY: NavItem = { href: "/activity", icon: History, label: "Activity" };
const SETTINGS: NavItem = { href: "/settings", icon: Settings, label: "Settings" };

// Sidebar sections, in the mockup's order.
export const NAV_GROUPS: NavGroup[] = [
  { items: [HOME, EXPENSES, BUDGET, RECURRING], label: "Everyday" },
  { items: [SAVINGS, LOANS, DHUKU], label: "Saving & lending" },
  { items: [REPORTS, CATEGORIES], label: "Insight" },
];

// Pinned to the bottom of the sidebar.
export const NAV_FOOTER: NavItem[] = [NOTIFICATIONS, ACTIVITY, SETTINGS];

// Phone bottom bar; everything else lives in its "More" sheet, grouped as in the sidebar.
export const BOTTOM_BAR: NavItem[] = [HOME, EXPENSES, BUDGET, SETTINGS];

export const MORE_GROUPS: NavGroup[] = [
  ...NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !BOTTOM_BAR.includes(item)) })),
  { items: NAV_FOOTER.filter((item) => !BOTTOM_BAR.includes(item)), label: "Updates" },
].filter((group) => group.items.length > 0);

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
