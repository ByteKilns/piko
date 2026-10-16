"use client";

import { useEffect, useRef } from "react";

import { type Driver, driver } from "driver.js";
import { usePathname } from "next/navigation";
import "driver.js/dist/driver.css";

import "./tour.css";
import { markSeen, readTourMemory, shouldAutoRun, skipAll, TOUR_STORAGE_KEY, type TourMemory } from "./tour-memory";
import { tourForPath, type TourId, TOURS } from "./tour-steps";
import { type ResolvedStep, resolveSteps } from "./tour-targets";

// Lets the page paint (and the sidebar finish its entrance) before measuring.
const SETTLE_MS = 400;
// The page streams in after the layout (loading.tsx shows first), so the tour
// keeps looking for its sections for a while before starting without them.
const WAIT_FOR_PAGE_MS = 5000;
const LOOK_AGAIN_MS = 200;

function findVisible(target: string): Element | null {
  for (const element of document.querySelectorAll(`[data-tour="${target}"]`)) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return element;
  }
  return null;
}

function readMemory(): TourMemory {
  return readTourMemory(window.localStorage.getItem(TOUR_STORAGE_KEY));
}

function writeMemory(memory: TourMemory): void {
  window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(memory));
}

function runTour(id: TourId, steps: ResolvedStep<Element>[]): Driver | null {
  if (steps.length === 0) return null;
  // Seen as soon as it starts: leaving mid-tour shouldn't bring it back, and
  // driver.js only reports closing after its animation, which a quick
  // navigation can cut short.
  writeMemory(markSeen(readMemory(), id));

  const tour = driver({
    doneBtnText: "Done",
    nextBtnText: "Next",
    onPopoverRender: (popover) => {
      if (popover.footer.querySelector(".piko-tour-skip")) return;
      const skip = document.createElement("button");
      skip.className = "piko-tour-skip";
      skip.textContent = "Skip all tours";
      skip.type = "button";
      skip.addEventListener("click", () => {
        writeMemory(skipAll(readMemory()));
        tour.destroy();
      });
      popover.footer.prepend(skip);
    },
    overlayColor: "#201e1d",
    overlayOpacity: 0.55,
    popoverClass: "piko-tour",
    prevBtnText: "Back",
    progressText: "{{current}} of {{total}}",
    showProgress: true,
    stagePadding: 6,
    stageRadius: 0,
    steps: steps.map(({ element, step }) => ({ element: element ?? undefined, popover: { description: step.body, title: step.title } })),
  });
  tour.drive();
  return tour;
}

// Runs a page's tour by itself the first time the visitor opens it, and again
// whenever `request` changes ("Tour this page" in the banner), even after
// they skipped them all. Loaded only for demo visitors (see DemoProvider).
export function DemoTour({ request }: { request: number }) {
  const pathname = usePathname();
  const active = useRef<Driver | null>(null);
  const lastRequest = useRef(request);

  useEffect(() => {
    const id = tourForPath(pathname);
    if (!id || !shouldAutoRun(readMemory(), id)) return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    function look(tourId: TourId) {
      const steps = resolveSteps(TOURS[tourId], findVisible);
      if (steps.length < TOURS[tourId].length && Date.now() - startedAt < WAIT_FOR_PAGE_MS) {
        timer = setTimeout(() => look(tourId), LOOK_AGAIN_MS);
        return;
      }
      active.current = runTour(tourId, steps);
    }
    timer = setTimeout(() => look(id), SETTLE_MS);
    return () => {
      clearTimeout(timer);
      active.current?.destroy();
      active.current = null;
    };
  }, [pathname]);

  useEffect(() => {
    if (request === lastRequest.current) return;
    lastRequest.current = request;
    const id = tourForPath(pathname);
    if (!id) return;
    active.current?.destroy();
    active.current = runTour(id, resolveSteps(TOURS[id], findVisible));
  }, [pathname, request]);

  return null;
}
