"use client";

import { Smartphone } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import { exitDemoAction } from "../api/demo.actions";
import { tourForPath } from "../tour/tour-steps";
import { useDemo } from "./DemoProvider";

// The thin bar on every page of a demo. Real accounts render nothing.
export function DemoBanner() {
  const demo = useDemo();
  const pathname = usePathname();
  if (!demo) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink bg-paper px-4 py-2 text-sm md:-mx-12 md:-mt-9 md:mb-9 md:px-12">
      <span className="font-semibold">Demo</span>
      <span className="text-n-700">Deleted in {demo.timeLeft}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          aria-pressed={demo.phoneOpen}
          data-tour="phone-button"
          onClick={() => demo.setPhoneOpen(!demo.phoneOpen)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Smartphone />
          Phone
        </Button>
        {tourForPath(pathname) && (
          <Button onClick={demo.requestTour} size="sm" type="button" variant="ghost">
            Tour this page
          </Button>
        )}
        <form action={exitDemoAction}>
          <Button size="sm" type="submit" variant="ghost">
            Exit demo
          </Button>
        </form>
      </div>
    </div>
  );
}
