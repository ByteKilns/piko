"use client";

import type { ReactNode } from "react";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  subtitle?: string;
  title: string;
};

// Every modal in the app should go through this component instead of
// reassembling Dialog/DialogContent/DialogHeader/DialogFooter by hand —
// that's where the header rule, scrollable body and footer (primary action,
// then Cancel) live, in one place.
//
// `bodyClassName` is an escape hatch for content with its own floating
// overlay (e.g. a date picker that isn't portaled) that needs to render
// past the body's default `overflow-y-auto` instead of being clipped/
// trapped inside it — pass `overflow-visible` there (and cancel
// DialogContent's own `overflow-hidden` via `className`) to let it float
// over the dialog instead.
export function Modal({ bodyClassName, children, className, footer, onOpenChange, open, subtitle, title }: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={className} showCloseButton={false}>
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle>{title}</DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </div>
          <DialogClose asChild>
            <Button aria-label="Close" size="icon-sm" type="button" variant="ghost">
              <XIcon />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className={cn("min-h-0 flex-1 space-y-5.5 overflow-y-auto p-6", bodyClassName)}>{children}</div>

        {footer && (
          <DialogFooter>
            {footer}
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
