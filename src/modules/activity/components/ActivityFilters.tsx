"use client";

import { useState } from "react";

import { CalendarDays, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { type ActivityFilterParams, activityHref } from "../lib/activity-query";
import { ACTION_GROUPS, ACTIVITY_SECTIONS } from "../lib/sections";

const ALL = "all";

type Props = { members: { id: string; name: string }[]; realMemberId: string; value: ActivityFilterParams };

// Filters live in the URL (so a filtered view can be shared or reloaded); the
// server page re-queries on every change.
export function ActivityFilters({ members, realMemberId, value }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(value.q ?? "");
  const hasActiveFilters = Boolean(value.action || value.from || value.member || value.q || value.section || value.to);

  // Any filter change starts again from the newest entries, so the cursor is dropped.
  function apply(patch: Partial<ActivityFilterParams>) {
    router.replace(activityHref({ ...value, ...patch, cursor: undefined }));
  }

  function clearFilters() {
    setQuery("");
    router.replace("/activity");
  }

  return (
    <div className="flex flex-wrap items-center gap-1 pt-4 pb-6">
      <form
        className="relative mr-2.5 min-w-48 flex-[0_1_290px]"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: query.trim() || undefined });
        }}
        role="search"
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-n-600" />
        <Input
          aria-label="Search activity"
          className="pl-8"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activity..."
          value={query}
        />
      </form>

      <label className="flex items-center gap-1.5 border border-n-400 px-2.5 py-1.5 text-sm text-n-800">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-n-600" />
        <input
          aria-label="From date"
          className="w-28 bg-transparent outline-none"
          onChange={(e) => apply({ from: e.target.value || undefined })}
          type="date"
          value={value.from ?? ""}
        />
        <span className="text-n-500">to</span>
        <input
          aria-label="To date"
          className="w-28 bg-transparent outline-none"
          onChange={(e) => apply({ to: e.target.value || undefined })}
          type="date"
          value={value.to ?? ""}
        />
      </label>

      <div className="mx-1 h-5 w-px shrink-0 bg-n-300" />

      <Select onValueChange={(v) => apply({ member: v === ALL ? undefined : v })} value={value.member ?? ALL}>
        <SelectTrigger aria-label="Member" className="text-muted-foreground" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Anyone</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.id === realMemberId ? "Me" : m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => apply({ section: v === ALL ? undefined : v })} value={value.section ?? ALL}>
        <SelectTrigger aria-label="Section" className="text-muted-foreground" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sections</SelectItem>
          {ACTIVITY_SECTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => apply({ action: v === ALL ? undefined : v })} value={value.action ?? ALL}>
        <SelectTrigger aria-label="Action" className="text-muted-foreground" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any action</SelectItem>
          {ACTION_GROUPS.map((g) => (
            <SelectItem key={g.value} value={g.value}>
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button className="ml-auto text-n-600" disabled={!hasActiveFilters} onClick={clearFilters} type="button" variant="ghost">
        Clear filters
      </Button>
    </div>
  );
}
