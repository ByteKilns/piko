"use client";

import { Button } from "@/components/ui/button";

import { exitDemoAction } from "../api/demo.actions";
import { useDemo } from "./DemoProvider";

// The thin bar on every page of a demo. Real accounts render nothing.
export function DemoBanner() {
  const demo = useDemo();
  if (!demo) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink bg-paper px-4 py-2 text-sm md:-mx-12 md:-mt-9 md:mb-9 md:px-12">
      <span className="font-semibold">Demo</span>
      <span className="text-n-700">Deleted in {demo.timeLeft}</span>
      <form action={exitDemoAction} className="ml-auto">
        <Button size="sm" type="submit" variant="ghost">
          Exit demo
        </Button>
      </form>
    </div>
  );
}
