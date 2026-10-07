"use client"

import * as React from "react"

import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Sheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/20 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  )
}

// Bottom-anchored sheet — the mobile "More" nav menu is the only current
// use case, so this only implements the bottom side rather than the usual
// four-side shadcn Sheet.
function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-t-xl bg-popover pb-[env(safe-area-inset-bottom)] text-sm text-popover-foreground border-t-2 border-rule duration-150 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className
        )}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close asChild data-slot="sheet-close">
            <Button
              className="absolute top-2 right-2"
              size="icon-sm"
              variant="ghost"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 flex-col gap-1 border-b bg-popover px-4 pt-4 pb-3", className)}
      data-slot="sheet-header"
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-heading text-base leading-none font-medium", className)}
      data-slot="sheet-title"
      {...props}
    />
  )
}

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger }
