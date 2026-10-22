// Shared between src/app/(app)/layout.tsx (reads it, server-side, to avoid a
// flash of the wrong sidebar width) and SidebarNav (writes it, client-side —
// this is a pure UI preference with no sensitive content, so it's set
// directly via document.cookie rather than a server action).
export const SIDEBAR_COLLAPSED_COOKIE_NAME = "sidebar-collapsed";

// Below this width (a tablet, a narrow window) the sidebar is the icon rail,
// whatever the saved preference: the full one would take a third of the page.
// SidebarNav remembers which side of it the window was in SIDEBAR_NARROW, so
// the layout draws the rail from the first paint on the next page load.
export const NARROW_SIDEBAR_QUERY = "(max-width: 1023px)";
export const SIDEBAR_NARROW_COOKIE_NAME = "sidebar-narrow";
