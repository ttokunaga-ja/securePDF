// Layout primitives shared across the workspace UI. Owning the page-card
// dimensions here (rather than in PageCard) keeps the thumbnail-scaling maths and
// the card that consumes it on a single source of truth, with a one-way
// components → lib dependency.

/** Base thumbnail card geometry; thumbnail sizes scale relative to these. */
export const PAGE_CARD_WIDTH = 172
export const PAGE_CARD_HEIGHT = 244

/** Movement (px) beyond which a pointer gesture counts as a drag, not a click. */
export const CLICK_MOVE_THRESHOLD = 6

// Resizable left (thumbnail) pane.
export const LEFT_PANE_MIN = 204
export const LEFT_PANE_MAX = 1120
export const LEFT_PANE_FALLBACK = 426
export const DIVIDER_WIDTH = 8

// Thumbnail card sizing derived from the pane width.
export const THUMBNAIL_CARD_MIN = 148
export const THUMBNAIL_CARD_MAX = 520
export const THUMBNAIL_WIDTH_BASE = 284
export const THUMBNAIL_WIDTH_RATIO = PAGE_CARD_WIDTH / THUMBNAIL_WIDTH_BASE
export const THUMBNAIL_CARD_RATIO = PAGE_CARD_HEIGHT / PAGE_CARD_WIDTH

// Main toolbar geometry.
export const MAIN_TOOLBAR_HEIGHT = 48
export const TOOLBAR_ICON_SIZE = 36
export const TOOLBAR_SVG_SIZE = 21
export const TOOLBAR_COMPACT_ICON_SIZE = 30
export const TOOLBAR_COMPACT_SVG_SIZE = 19

// Preview zoom bounds.
export const ZOOM_MIN = 0.35
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.1
