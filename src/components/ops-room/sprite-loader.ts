// Sprite sheet loader for custom agent sprites
// Checks /sprites/[agentId].png — falls back to programmatic pixel art if not found
//
// Sprite sheet format: 3 rows x 6 columns
// Row 0: idle/standing (frames 0-5)
// Row 1: walking (frames 0-5)
// Row 2: sitting/working at desk (frames 0-5)

export type AnimState = "idle" | "walking" | "sitting";

interface SpriteSheet {
  image: HTMLImageElement;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  loaded: boolean;
}

const cache = new Map<string, SpriteSheet | null>();
const loading = new Set<string>();

// Row mapping
const ROW_MAP: Record<AnimState, number> = {
  idle: 0,
  walking: 1,
  sitting: 2,
};

/**
 * Try to load a sprite sheet for the given agent.
 * Returns the cached SpriteSheet if loaded, null if not available.
 * Triggers async load on first call.
 */
export function getSpriteSheet(agentId: string): SpriteSheet | null {
  // Already resolved
  if (cache.has(agentId)) return cache.get(agentId) ?? null;

  // Already loading
  if (loading.has(agentId)) return null;

  // Start loading
  loading.add(agentId);
  const img = new Image();
  img.src = `/sprites/${agentId}.png`;

  img.onload = () => {
    loading.delete(agentId);
    cache.set(agentId, {
      image: img,
      frameW: Math.floor(img.width / 6),
      frameH: Math.floor(img.height / 3),
      cols: 6,
      rows: 3,
      loaded: true,
    });
  };

  img.onerror = () => {
    // No custom sprite — mark as null so we don't retry
    loading.delete(agentId);
    cache.set(agentId, null);
  };

  return null;
}

/**
 * Draw a sprite sheet frame onto the canvas.
 * Returns true if drawn, false if no sprite sheet available (use fallback).
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  agentId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  state: AnimState,
  tick: number,
): boolean {
  const sheet = getSpriteSheet(agentId);
  if (!sheet) return false;

  const row = ROW_MAP[state];
  // Animate through frames at ~4 FPS (every 2 ticks at 8 FPS render)
  const frame = Math.floor(tick / 2) % sheet.cols;

  const sx = frame * sheet.frameW;
  const sy = row * sheet.frameH;

  ctx.drawImage(
    sheet.image,
    sx, sy, sheet.frameW, sheet.frameH,
    x, y, width, height,
  );

  return true;
}

/**
 * Check if a sprite sheet is available (loaded or loading).
 */
export function hasSpriteSheet(agentId: string): boolean {
  return cache.get(agentId)?.loaded === true;
}
