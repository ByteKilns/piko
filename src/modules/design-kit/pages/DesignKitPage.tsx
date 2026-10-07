import { ArrowUpRight, FileDown, ListPlus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { buildMonthNav } from "@/lib/month-nav";
import { DesignKitDemo } from "@/modules/design-kit/components/DesignKitDemo";

// Temporary review page for the phase-1 building blocks (removed in phase 6).
export function DesignKitPage() {
  const monthNav = buildMonthNav({
    basePath: "/design-kit",
    current: { month: 6, year: 2083 },
    dateFormat: "nepali",
    selected: { month: 6, year: 2083 },
  });

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/reports">
                Full report
                <ArrowUpRight />
              </Link>
            </Button>
            <Button type="button" variant="outline">
              <ListPlus />
              Bulk add
            </Button>
            <Button type="button" variant="outline">
              <FileDown />
              Export
            </Button>
          </>
        }
        meta="12 days left in the month"
        monthNav={monthNav}
        title="Design kit"
      />
      <DesignKitDemo />
    </div>
  );
}
