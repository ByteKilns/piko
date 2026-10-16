import type { TourStep } from "./tour-steps";

export type ResolvedStep<E> = { element: E | null; step: TourStep };

// Pairs each step with the first of its sections that's on screen. A step
// with targets but none on screen is dropped; a step with no targets stays
// (it sits in the middle).
export function resolveSteps<E>(steps: TourStep[], findVisible: (target: string) => E | null): ResolvedStep<E>[] {
  return steps.flatMap((step): ResolvedStep<E>[] => {
    if (step.targets.length === 0) return [{ element: null, step }];
    for (const target of step.targets) {
      const element = findVisible(target);
      if (element !== null) return [{ element, step }];
    }
    return [];
  });
}
