// ============================================================
// Pixel Art Sprite Engine — Programmatic character generation
// All characters drawn directly on canvas, no external assets
// Variable heights: small (8), normal (11), tall (14), special
// ============================================================

const T = ""; // transparent

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[][],
  x: number, y: number, scale: number = 2,
) {
  for (let r = 0; r < sprite.length; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      const clr = sprite[r][c];
      if (clr === T) continue;
      ctx.fillStyle = clr;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

// ============ CHARACTER SYSTEM ============
// Each character returns a sprite grid + its height in rows
// Draw scale in canvas is S (typically 4), so pixel height = rows * S

export interface CharacterDef {
  sprite: string[][];
  rows: number;
  cols: number;
}

// Height classes (in sprite rows)
const H_SMALL = 8;   // 32-36px at S=4
const H_NORM = 11;   // 44-48px at S=4
const H_TALL = 14;   // 52-56px at S=4

export function getCharacterDef(agentId: string): CharacterDef {
  switch (agentId) {
    // ===== MANAGEMENT =====
    case "sem": return makeSem();
    case "theo": return makeTheo();
    case "toby": return makeTobyCat();
    case "jones": return makeJones();

    // ===== BUILDERS =====
    case "wout": return makeWout();
    case "bas": return makeBas();
    case "gabriel": return makeGabriel();
    case "object51": return makeAlien();
    case "tijmen": return makeTijmen();
    case "pedro": return makePedro();
    case "vincent": return makeVincent();
    case "adam": return makeAdam();
    case "noah": return makeNoah();
    case "jack": return makeJack();
    case "nikkie": return makeNikkie();
    case "xia": return makeXia();
    case "thijs": return makeThijs();
    case "leonard": return makeLeonard();
    case "rijk": return makeRijk();
    case "coen": return makeCoenFish();
    case "senna": return makeSenna();

    // ===== SUPPORT =====
    case "ari": return makeAri();
    case "rodi": return makeRodi();

    default: return makeGeneric();
  }
}

// Legacy compat wrapper
export function getCharacterSprite(agentId: string, _avatarColor: string): string[][] {
  return getCharacterDef(agentId).sprite;
}

// ============ HELPER FUNCTIONS ============

function row(w: number, ...pixels: string[]): string[] {
  const r = Array(w).fill(T);
  const start = Math.floor((w - pixels.length) / 2);
  pixels.forEach((p, i) => { r[start + i] = p; });
  return r;
}

function fillR(grid: string[][], r: number, from: number, to: number, color: string) {
  for (let c = from; c < to; c++) grid[r][c] = color;
}

function lighten(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, parseInt(h.substring(0, 2), 16) + amt);
  const g = Math.min(255, parseInt(h.substring(2, 4), 16) + amt);
  const b = Math.min(255, parseInt(h.substring(4, 6), 16) + amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darken(hex: string, amt: number): string { return lighten(hex, -amt); }

// ============ HUMAN BUILDER ============
// Flexible human generator with many options

interface HumanOpts {
  height: number;   // H_SMALL, H_NORM, H_TALL
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  eyeColor?: string;
  curlyHair?: boolean;
  longHair?: boolean;  // for women
  mullet?: boolean;
  beard?: boolean;     // full beard
  beardColor?: string; // custom beard color (default: darken(hair))
  stubble?: boolean;   // short beard/sikje
  mustache?: boolean;
  glasses?: boolean;
  hat?: string;        // hat color
  headset?: boolean;
  earring?: boolean;
  hunched?: boolean;   // gebogen houding
  rainbow?: boolean;   // rainbow shirt
  camo?: boolean;      // camouflage shirt
  striped?: string;    // second color for striped shirt
  tie?: string;        // tie color
}

function makeHuman(opts: HumanOpts): CharacterDef {
  const W = 12; // sprite width
  const H = opts.height;
  const s: string[][] = Array.from({ length: H }, () => Array(W).fill(T));

  const { skin, hair, shirt, pants } = opts;
  const hl = lighten(hair, 35);
  const E = opts.eyeColor ?? "#1a1a2e";
  const sd = darken(shirt, 20);
  const O = "#1a1210"; // outline
  const sh = "#2a2a2a"; // shoes

  // Scale body parts based on height
  const headStart = 0;
  const headH = opts.height >= H_TALL ? 5 : opts.height >= H_NORM ? 4 : 3;
  const bodyStart = headStart + headH;
  const bodyH = opts.height >= H_TALL ? 5 : opts.height >= H_NORM ? 4 : 3;
  const legStart = bodyStart + bodyH;
  const legH = H - legStart;

  // --- HAIR ---
  if (opts.hat) {
    const hc = opts.hat;
    fillR(s, headStart, 3, 9, hc);
    if (headH > 3) fillR(s, headStart + 1, 2, 10, hc);
    fillR(s, headStart + (headH > 3 ? 2 : 1), 2, 10, darken(hc, 20)); // brim
  } else if (opts.curlyHair) {
    fillR(s, headStart, 3, 9, hair);
    s[headStart][4] = hl; s[headStart][7] = hl;
    if (headH > 3) {
      fillR(s, headStart + 1, 2, 10, hair);
      s[headStart + 1][3] = hl; s[headStart + 1][6] = hl; s[headStart + 1][9] = hl;
    }
    // Side curls
    s[headStart + (headH > 3 ? 2 : 1)][2] = hair;
    s[headStart + (headH > 3 ? 2 : 1)][9] = hair;
    if (headH > 4) {
      s[headStart + 3][2] = hair; s[headStart + 3][9] = hair;
    }
  } else if (opts.longHair) {
    fillR(s, headStart, 3, 9, hair);
    if (headH > 3) fillR(s, headStart + 1, 2, 10, hair);
    // Long sides
    for (let r = headStart + 1; r < bodyStart + 2 && r < H; r++) {
      s[r][2] = hair; s[r][9] = hair;
    }
  } else if (opts.mullet) {
    fillR(s, headStart, 3, 9, hair);
    s[headStart][4] = hl; s[headStart][7] = hl;
    if (headH > 3) fillR(s, headStart + 1, 2, 10, hair);
    // Mullet: long back
    for (let r = headStart + 1; r < bodyStart + 3 && r < H; r++) {
      s[r][9] = hair; s[r][10] = hair;
    }
  } else {
    // Standard short hair
    fillR(s, headStart, 3, 9, hair);
    if (headH > 3) {
      fillR(s, headStart + 1, 2, 10, hair);
      s[headStart + 1][4] = hl;
    }
  }

  // --- FACE ---
  const faceR = headStart + (headH > 3 ? 2 : 1);
  fillR(s, faceR, 3, 9, skin);
  if (faceR + 1 < bodyStart) {
    fillR(s, faceR + 1, 3, 9, skin);
    // Eyes
    s[faceR + 1][4] = "#fff"; s[faceR + 1][5] = E;
    s[faceR + 1][7] = E; s[faceR + 1][8] = "#fff";
    // Glasses
    if (opts.glasses) {
      s[faceR + 1][3] = O; s[faceR + 1][6] = O; s[faceR + 1][9] = O;
    }
  }
  if (faceR + 2 < bodyStart) {
    fillR(s, faceR + 2, 4, 8, skin);
    // Nose
    s[faceR + 2][6] = darken(skin, 20);
    // Mouth
    s[faceR + 2][5] = "#a85050";
  } else if (faceR + 1 < bodyStart) {
    // Small characters: add mouth on same row as eyes
    s[faceR + 1][6] = "#a85050";
  }

  // Beard/stubble/mustache
  if (opts.beard && faceR + 2 < bodyStart) {
    const bc = opts.beardColor ?? darken(hair, 10);
    s[faceR + 2][4] = bc; s[faceR + 2][5] = bc; s[faceR + 2][6] = bc; s[faceR + 2][7] = bc;
    if (faceR + 1 < bodyStart) {
      s[faceR + 1][3] = bc; s[faceR + 1][9] = bc;
    }
  } else if (opts.stubble && faceR + 2 < bodyStart) {
    const bc = darken(skin, 25);
    s[faceR + 2][4] = bc; s[faceR + 2][7] = bc;
  }
  if (opts.mustache && faceR + 2 < bodyStart) {
    s[faceR + 2][5] = darken(hair, 10);
    s[faceR + 2][6] = darken(hair, 10);
  }

  // Earring
  if (opts.earring && faceR + 1 < bodyStart) {
    s[faceR + 1][9] = "#f59e0b";
  }

  // Headset
  if (opts.headset && faceR > 0) {
    s[faceR][2] = "#333"; s[faceR + 1][2] = "#333";
    if (faceR + 2 < H) { s[faceR + 2][2] = "#4ade80"; s[faceR + 2][1] = "#4ade80"; }
  }

  // --- BODY (shirt) ---
  for (let r = bodyStart; r < bodyStart + bodyH && r < H; r++) {
    const bw = 6; // slim body, everyone fit
    const bx = Math.floor((W - bw) / 2);
    if (opts.rainbow) {
      const rainbow = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e"];
      for (let c = bx; c < bx + bw; c++) {
        s[r][c] = rainbow[(c - bx) % rainbow.length];
      }
    } else if (opts.camo) {
      const camo = ["#4a5c2a", "#3a4a20", "#5a6a3a", "#2a3a18"];
      for (let c = bx; c < bx + bw; c++) {
        s[r][c] = camo[(r * 3 + c) % camo.length];
      }
    } else if (opts.striped && r % 2 === 0) {
      fillR(s, r, bx, bx + bw, opts.striped);
    } else {
      fillR(s, r, bx, bx + bw, r === bodyStart + bodyH - 1 ? sd : shirt);
    }
    // Arms — long sleeves if tie (suit), otherwise short sleeves (skin)
    const armMid = bodyStart + Math.floor(bodyH / 2);
    if (r >= armMid - 1 && r <= armMid + 1) {
      const armColor = opts.tie ? (r === armMid + 1 ? skin : shirt) : skin;
      s[r][bx - 1] = armColor;
      s[r][bx + bw] = armColor;
    }
  }

  // --- TIE ---
  if (opts.tie) {
    for (let r = bodyStart; r < bodyStart + bodyH - 1 && r < H; r++) {
      s[r][6] = opts.tie;
    }
  }

  // --- LEGS + SHOES ---
  for (let r = legStart; r < H; r++) {
    if (r >= H - 1) {
      // Shoes
      s[r][3] = sh; s[r][4] = sh; s[r][5] = sh;
      s[r][7] = sh; s[r][8] = sh; s[r][9] = sh;
    } else if (r >= H - 2) {
      s[r][4] = pants; s[r][5] = pants;
      s[r][7] = pants; s[r][8] = pants;
    } else {
      fillR(s, r, 3, 9, pants);
    }
  }

  // Hunched posture: shift top of body right by 1
  if (opts.hunched) {
    for (let r = 0; r < bodyStart; r++) {
      s[r] = [T, ...s[r].slice(0, W - 1)];
    }
  }

  return { sprite: s, rows: H, cols: W };
}

// ============ SPECIAL CHARACTERS ============

function makeTobyCat(): CharacterDef {
  // White cat with glasses, sitting on chair
  const W = 12;
  const H = H_NORM;
  const s: string[][] = Array.from({ length: H }, () => Array(W).fill(T));
  const w = "#e8e0d8"; // white fur
  const wd = "#c8c0b8"; // fur shadow
  const p = "#ffb6c1"; // pink (nose, inner ear)
  const O = "#333";
  const wh = "#aaa"; // whiskers

  // Ears (row 0-1)
  s[0][3] = w; s[0][4] = w;    s[0][7] = w; s[0][8] = w;
  s[1][3] = p; s[1][4] = w;    s[1][7] = w; s[1][8] = p;

  // Head (row 2-4)
  fillR(s, 2, 2, 10, w);
  fillR(s, 3, 2, 10, w);
  // Eyes with glasses
  s[3][3] = O; s[3][4] = "#4488cc"; s[3][5] = O; s[3][6] = O; s[3][7] = "#4488cc"; s[3][8] = O;
  fillR(s, 4, 3, 9, w);
  // Nose
  s[4][5] = p; s[4][6] = p;
  // Whiskers
  s[4][1] = wh; s[4][2] = wh;  s[4][9] = wh; s[4][10] = wh;
  s[3][1] = wh;                 s[3][10] = wh;

  // Body (row 5-8)
  fillR(s, 5, 3, 9, w);
  fillR(s, 6, 2, 10, w);
  fillR(s, 7, 2, 10, wd);
  fillR(s, 8, 3, 9, w);

  // Paws (row 9)
  s[9][3] = wd; s[9][4] = wd;  s[9][7] = wd; s[9][8] = wd;

  // Tail (row 7-8 extending right)
  s[7][10] = w; s[7][11] = w;
  s[8][11] = w;

  return { sprite: s, rows: H, cols: W };
}

function makeAlien(): CharacterDef {
  // Green alien with big black eyes, big head, small body
  const W = 12;
  const H = H_NORM;
  const s: string[][] = Array.from({ length: H }, () => Array(W).fill(T));
  const g = "#4ade80"; // green skin
  const gd = "#22c55e"; // dark green
  const eye = "#0a0a0a"; // big black eyes

  // Big head (row 0-5)
  fillR(s, 0, 4, 8, g);
  fillR(s, 1, 3, 9, g);
  fillR(s, 2, 2, 10, g);
  fillR(s, 3, 2, 10, g);
  // Giant eyes
  s[3][3] = eye; s[3][4] = eye; s[3][5] = eye;
  s[3][7] = eye; s[3][8] = eye; s[3][9] = eye;
  s[2][3] = eye; s[2][4] = eye;
  s[2][8] = eye; s[2][9] = eye;
  // Eye shine
  s[2][4] = "#333"; s[2][8] = "#333";

  fillR(s, 4, 3, 9, g);
  // Mouth (small line)
  s[4][5] = gd; s[4][6] = gd;
  fillR(s, 5, 4, 8, g);

  // Thin body (row 6-9)
  fillR(s, 6, 4, 8, g);
  fillR(s, 7, 4, 8, gd);
  fillR(s, 8, 5, 7, g);

  // Thin legs (row 9-10)
  s[9][4] = gd; s[9][5] = gd;  s[9][7] = gd; s[9][8] = gd;
  s[10][4] = gd; s[10][5] = gd; s[10][7] = gd; s[10][8] = gd;

  return { sprite: s, rows: H, cols: W };
}

function makeCoenFish(): CharacterDef {
  // Blue fish sitting at a desk, tiny fins "typing"
  const W = 12;
  const H = H_NORM;
  const s: string[][] = Array.from({ length: H }, () => Array(W).fill(T));
  const b = "#3b82f6"; // blue
  const bd = "#2563eb"; // dark blue
  const bl = "#60a5fa"; // light blue

  // Tail (row 0-2)
  s[0][2] = bd; s[0][3] = bd;
  s[1][1] = bd; s[1][2] = b;
  s[2][1] = bd; s[2][2] = b;

  // Body (row 2-7, oval)
  fillR(s, 2, 3, 9, b);
  fillR(s, 3, 3, 10, b); s[3][3] = bl;
  fillR(s, 4, 3, 10, b); s[4][4] = bl;
  // Eye
  s[4][7] = "#fff"; s[4][8] = "#1a1a2e";
  fillR(s, 5, 3, 10, b);
  // Mouth
  s[5][9] = "#333";
  fillR(s, 6, 3, 9, bd);
  fillR(s, 7, 4, 8, bd);

  // Belly stripe
  s[5][4] = bl; s[5][5] = bl; s[6][4] = bl;

  // Top fin
  s[1][5] = bd; s[1][6] = b; s[1][7] = bd;

  // Bottom fins (for "typing")
  s[8][4] = bd; s[8][5] = bd;
  s[8][7] = bd; s[8][8] = bd;

  // Bubbles
  s[0][8] = "#87ceeb50";
  s[1][9] = "#87ceeb30";

  return { sprite: s, rows: H, cols: W };
}

// ============ INDIVIDUAL CHARACTERS ============

function makeSem(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#f0c8a0", hair: "#3a2010",
    shirt: "#1a1a2a", pants: "#1a1a2a", // black suit
    eyeColor: "#4488cc", curlyHair: true, stubble: true, mustache: true,
    tie: "#e0e0e0",
  });
}

function makeTheo(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#f0c8a0", hair: "#4a3018",
    shirt: "#2a2a35", pants: "#1a1a25",
    eyeColor: "#553311", curlyHair: true, beard: true, beardColor: "#888888",
    tie: "#e0e0e0",
  }); // brown curls, grey beard, black suit + white tie
}

function makeJones(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#d4a870", hair: "#3a2010",
    shirt: "#8B7355", pants: "#5c4a30", // khaki/brown explorer outfit
    eyeColor: "#553311", hat: "#6b4226", // brown fedora (Indiana Jones)
    stubble: true,
  });
}

function makeWout(): CharacterDef {
  return makeHuman({
    height: H_NORM, skin: "#f0c8a0", hair: "#e8c840",
    shirt: "#1a1a2a", pants: "#2a2a3a",
    eyeColor: "#4488cc", curlyHair: true,
  });
}

function makeBas(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#f0c8a0", hair: "#c44a1a",
    shirt: "#6b4226", pants: "#2a2a3a",
    eyeColor: "#22aa44", earring: true,
  });
}

function makeGabriel(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#a07848", hair: "#1a1210",
    shirt: "#1a1a2a", pants: "#2a2a3a",
    eyeColor: "#331a0a",
  });
}

function makeTijmen(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#f0c8a0", hair: "#c4601a",
    shirt: "#1a1a2a", pants: "#2a2a3a",
    eyeColor: "#4488cc", curlyHair: true,
  });
}

function makePedro(): CharacterDef {
  return makeHuman({
    height: H_NORM, skin: "#e0b890", hair: "#888888",
    shirt: "#1a1a2a", pants: "#2a2a3a",
    eyeColor: "#553311", mustache: true, hunched: true,
  });
}

function makeVincent(): CharacterDef {
  return makeHuman({
    height: H_SMALL, skin: "#f0c8a0", hair: "#888888",
    shirt: "#1a1a2a", pants: "#2a2a3a",
    eyeColor: "#4455aa", curlyHair: true, glasses: true, hunched: true,
  });
}

function makeAdam(): CharacterDef {
  return makeHuman({
    height: H_SMALL, skin: "#f0c8a0", hair: "#1a1a2e",
    shirt: "#1e3a5f", pants: "#2a2a3a",
    eyeColor: "#553311",
  });
}

function makeNoah(): CharacterDef {
  return makeHuman({
    height: H_SMALL, skin: "#f0c8a0", hair: "#1a1a2e",
    shirt: "#60a5fa", pants: "#2a2a3a",
    eyeColor: "#553311",
  });
}

function makeJack(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#f0c8a0", hair: "#4a3018",
    shirt: "#6b7280", pants: "#2a2a3a",
    eyeColor: "#553311",
  }); // short dark hair, no curls, no hat
}

function makeNikkie(): CharacterDef {
  return makeHuman({
    height: H_SMALL, skin: "#f0d0a0", hair: "#0a0a0a",
    shirt: "#a7f3d0", pants: "#2a2a3a",
    eyeColor: "#1a1210", longHair: true,
  });
}

function makeXia(): CharacterDef {
  return makeHuman({
    height: H_SMALL, skin: "#f0d0a0", hair: "#0a0a0a",
    shirt: "#f87171", pants: "#2a2a3a",
    eyeColor: "#1a1210",
  });
}

function makeThijs(): CharacterDef {
  return makeHuman({
    height: H_NORM, skin: "#f0c8a0", hair: "#d4a828",
    shirt: "#1e3a5f", pants: "#2a2a3a",
    eyeColor: "#4488cc", mullet: true,
  });
}

function makeLeonard(): CharacterDef {
  return makeHuman({
    height: H_NORM, skin: "#6b4226", hair: "#1a1210",
    shirt: "#1a1a2a", pants: "#2a2a3a",
    eyeColor: "#331a0a",
  });
}

function makeRijk(): CharacterDef {
  return makeHuman({
    height: H_NORM, skin: "#f0c8a0", hair: "#d4a828",
    shirt: "#ef4444", pants: "#2a2a3a", // shirt overridden by rainbow
    eyeColor: "#4488cc", rainbow: true,
  });
}

function makeSenna(): CharacterDef {
  return makeHuman({
    height: H_NORM, skin: "#f0c8a0", hair: "#c4841d",
    shirt: "#4a5c2a", pants: "#3a4a20",
    eyeColor: "#4488cc", camo: true,
  });
}

function makeAri(): CharacterDef {
  return makeHuman({
    height: H_TALL, skin: "#d4a070", hair: "#1a1210",
    shirt: "#7dd3fc", pants: "#e8e8ee",
    eyeColor: "#331a0a",
    striped: "#ffffff", // Argentina: light blue + white stripes, white shorts
  });
}

function makeRodi(): CharacterDef {
  // Messi! Barca shirt (blue-red striped), beard
  return makeHuman({
    height: H_NORM, skin: "#e0b890", hair: "#1a1210",
    shirt: "#2563eb", pants: "#1e40af",
    eyeColor: "#331a0a", stubble: true,
    striped: "#dc2626", // red stripes on blue
  });
}

function makeGeneric(): CharacterDef {
  return makeHuman({
    height: H_NORM, skin: "#f0c8a0", hair: "#3a2010",
    shirt: "#6b7280", pants: "#2a2a3a",
  });
}

// ============ DESK UNIT (variable height support) ============

export function drawDeskUnit(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  agent: { naam: string; avatar: string; status: string; id: string },
  projectColor: string,
  tick: number,
  isSelected: boolean,
  scale: number = 4,
  skipCharacter: boolean = false,
) {
  const s = scale;
  const isActive = agent.status === "working" || agent.status === "reviewing";
  const isOffline = agent.status === "offline";
  const isIdle = agent.status === "idle";
  const charDef = getCharacterDef(agent.id);

  // Desk surface Y — fixed position, character positioned above it
  const deskY = y + 16 * s;
  const deskW = 26 * s;
  const deskH = 5 * s;

  // Character positioned so bottom overlaps desk (skip if hover stand-up)
  if (!isOffline && !skipCharacter) {
    const charH = charDef.rows * s;
    const charY = deskY - charH + 3 * s; // overlap desk by 3 rows
    const charX = x + Math.floor((30 - charDef.cols) / 2) * s;
    const bobY = isIdle ? Math.sin(tick * 0.3 + x) * 1.5 : 0;
    const lookX = isIdle ? Math.sin(tick * 0.15 + y) * 1 : 0;
    drawSprite(ctx, charDef.sprite, charX + lookX, charY + bobY, s);
  }

  // Desk surface
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x + 2 * s, deskY, deskW, deskH);
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(x + 2 * s, deskY + deskH, deskW, 2 * s);
  ctx.fillStyle = "#3a2818";
  ctx.fillRect(x + 3 * s, deskY + deskH + 2 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 25 * s, deskY + deskH + 2 * s, 2 * s, 2 * s);

  // Monitor
  const monW = 14 * s;
  const monH = 9 * s;
  const monX = x + 8 * s;
  const monY = deskY - monH + 2 * s;
  ctx.fillStyle = "#2a2a3a";
  ctx.fillRect(monX, monY, monW, monH);
  ctx.fillStyle = isActive ? projectColor : isOffline ? "#0a0a15" : "#141420";
  ctx.fillRect(monX + s, monY + s, monW - 2 * s, monH - 2 * s);
  if (isActive) {
    const glow = 0.08 + Math.sin(tick * 0.4 + x * 0.01) * 0.05;
    ctx.fillStyle = `rgba(${hexToRgb(projectColor)}, ${glow})`;
    ctx.fillRect(monX + s, monY + s, monW - 2 * s, monH - 2 * s);
    ctx.fillStyle = `${projectColor}60`;
    for (let ln = 0; ln < 3; ln++) {
      const lw = 4 + ((tick + ln * 3) % 6);
      ctx.fillRect(monX + 2 * s, monY + (2 + ln * 2) * s, lw * s, s);
    }
  }
  ctx.fillStyle = "#2a2a3a";
  ctx.fillRect(monX + 6 * s, monY + monH, 2 * s, s);

  // Keyboard
  if (!isOffline) {
    ctx.fillStyle = isActive && tick % 4 < 2 ? "#555565" : "#444454";
    ctx.fillRect(x + 9 * s, deskY + s, 12 * s, 3 * s);
  }

  // Empty chair
  if (isOffline) {
    ctx.fillStyle = "#3a3a4a";
    ctx.save();
    ctx.translate(x + 16 * s, deskY + 6 * s);
    ctx.rotate(0.15);
    ctx.fillRect(-3 * s, 0, 6 * s, 4 * s);
    ctx.fillRect(-4 * s, -2 * s, 8 * s, 2 * s);
    ctx.restore();
  }

  // Name
  const fs = Math.max(10, s * 3);
  ctx.font = `bold ${fs}px monospace`;
  const nw = ctx.measureText(agent.naam).width;
  ctx.fillStyle = "#0a0f14cc";
  ctx.fillRect(x + 2 * s - 2, y + 26 * s - fs + 2, nw + 8, fs + 3);
  ctx.fillStyle = agent.avatar;
  ctx.fillText(agent.naam, x + 2 * s, y + 26 * s);

  // Selection
  if (isSelected) {
    ctx.strokeStyle = "#23C6B7";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y - 2 * s, 30 * s, 30 * s);
    ctx.setLineDash([]);
  }
}

// ============ SEM L-DESK ============

export function drawSemDesk(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  tick: number, isSelected: boolean, s: number = 4,
) {
  const charDef = getCharacterDef("sem");
  const deskY = y + 16 * s;
  const charH = charDef.rows * s;
  const charY = deskY - charH + 3 * s;

  // Chair (behind desk, behind character)
  const chX = x + 7 * s;
  const chBotY = deskY - s;
  ctx.fillStyle = "#353545";
  ctx.fillRect(chX + s, chBotY - 10 * s, 8 * s, 4 * s);
  ctx.fillStyle = "#404055";
  ctx.fillRect(chX + 2 * s, chBotY - 9 * s, 6 * s, 2 * s);
  ctx.fillStyle = "#303040";
  ctx.fillRect(chX, chBotY - 2 * s, 10 * s, 2 * s);
  ctx.fillStyle = "#2a2a38";
  ctx.fillRect(chX - s, chBotY - 4 * s, s, 3 * s);
  ctx.fillRect(chX + 10 * s, chBotY - 4 * s, s, 3 * s);
  ctx.fillStyle = "#252530";
  ctx.fillRect(chX + 4 * s, chBotY, 2 * s, s);

  drawSprite(ctx, charDef.sprite, x + 6 * s, charY, s);

  // L-desk
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x, deskY, 28 * s, 5 * s);
  ctx.fillRect(x + 22 * s, deskY - 7 * s, 6 * s, 12 * s);
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(x, deskY + 5 * s, 28 * s, 2 * s);
  ctx.fillStyle = "#3a2818";
  ctx.fillRect(x + s, deskY + 7 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 25 * s, deskY + 7 * s, 2 * s, 2 * s);

  // Two wide monitors
  const glow = 0.6 + Math.sin(tick * 0.35) * 0.15;
  for (let m = 0; m < 2; m++) {
    const mx = x + (1 + m * 13) * s;
    const my = deskY - 2 * s;
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(mx, my, 13 * s, 7 * s);
    ctx.fillStyle = `rgba(35, 198, 183, ${glow * 0.25})`;
    ctx.fillRect(mx + s, my + s, 11 * s, 5 * s);
    ctx.fillStyle = "#23C6B750";
    for (let ln = 0; ln < 2; ln++) {
      ctx.fillRect(mx + 2 * s, my + (2 + ln * 2) * s, (6 + (tick + ln) % 5) * s, s);
    }
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(mx + 5 * s, my + 7 * s, 3 * s, s);
  }

  // Coffee cup on L-desk corner (top)
  const ccX = x + 24 * s;
  const ccY = deskY - 7 * s;
  ctx.fillStyle = "#d0c8b8";
  ctx.fillRect(ccX, ccY, 2 * s, 2.5 * s);
  ctx.fillStyle = "#5c3a1a";
  ctx.fillRect(ccX + 0.3 * s, ccY + 0.4 * s, 1.4 * s, 1 * s);
  ctx.fillStyle = "#d0c8b8";
  ctx.fillRect(ccX + 2 * s, ccY + 0.5 * s, 0.6 * s, 1.5 * s);
  // Steam
  if (tick % 8 < 5) {
    ctx.fillStyle = "#ffffff12";
    ctx.fillRect(ccX + 0.5 * s, ccY - s + (tick % 3) * 0.2, 0.4 * s, 0.8 * s);
    ctx.fillRect(ccX + 1.2 * s, ccY - 1.3 * s + (tick % 4) * 0.15, 0.4 * s, 0.8 * s);

  }

  // Label: Crown icon + Sem / CEO / → Autronis
  const labelX = x + 2 * s;
  const labelY = y + 27 * s;
  // Crown icon (Lucide-style, stroked)
  const crW = 16;
  const crSc = crW / 24;
  ctx.save();
  ctx.translate(labelX, labelY - 11);
  ctx.scale(crSc, crSc);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(2, 17); ctx.lineTo(2, 4); ctx.lineTo(7, 8); ctx.lineTo(12, 2);
  ctx.lineTo(17, 8); ctx.lineTo(22, 4); ctx.lineTo(22, 17);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "#f59e0b30";
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, 20); ctx.lineTo(22, 20); ctx.stroke();
  // Gem
  ctx.fillStyle = "#ef4444";
  ctx.beginPath(); ctx.arc(12, 12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const crownW = crW + 4;
  // Name
  ctx.font = "bold 12px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Sem", labelX + crownW, labelY);
  const semNW = ctx.measureText("Sem").width;
  // CEO label
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#a0b0ba";
  ctx.fillText("CEO", labelX + crownW + semNW + 4, labelY);
  // Project
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#23C6B7";
  ctx.fillText("→ Autronis", labelX, labelY + 16);

  if (isSelected) {
    ctx.strokeStyle = "#23C6B7";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x - s, y - 2 * s, 30 * s, 32 * s);
    ctx.setLineDash([]);
  }
}

// ============ ENVIRONMENT (unchanged) ============

export function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, tileSize: number) {
  for (let r = 0; r < Math.ceil(h / tileSize); r++) {
    for (let c = 0; c < Math.ceil(w / tileSize); c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#2a3240" : "#283040";
      ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
      ctx.fillStyle = (r + c) % 2 === 0 ? "#2e3648" : "#2c3446";
      ctx.fillRect(c * tileSize + 4, r * tileSize + 4, 2, 2);
      ctx.fillRect(c * tileSize + tileSize / 2 + 2, r * tileSize + tileSize / 2 + 2, 2, 2);
    }
  }
}

export function drawWalls(ctx: CanvasRenderingContext2D, w: number) {
  ctx.fillStyle = "#3a4a5a";
  ctx.fillRect(0, 0, w, 20);
  ctx.fillStyle = "#2a3a4a";
  ctx.fillRect(0, 20, w, 6);
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(0, 26, w, 3);
  ctx.fillStyle = "#3a4a5a";
  ctx.fillRect(0, 0, 8, 900);
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(8, 0, 3, 900);
}

export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#4a5a6a";
  ctx.fillRect(x, y, 40, 36);
  ctx.fillStyle = "#1a3050";
  ctx.fillRect(x + 3, y + 3, 15, 13);
  ctx.fillRect(x + 22, y + 3, 15, 13);
  ctx.fillRect(x + 3, y + 20, 15, 13);
  ctx.fillRect(x + 22, y + 20, 15, 13);
  ctx.fillStyle = "#2a508020";
  ctx.fillRect(x + 4, y + 4, 6, 5);
  ctx.fillRect(x + 23, y + 4, 6, 5);
}

export function drawCeilingLight(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number) {
  ctx.fillStyle = "#5a6a7a";
  ctx.fillRect(x - 8, y, 16, 4);
  ctx.fillStyle = "#f0e8d0";
  ctx.fillRect(x - 6, y + 4, 12, 3);
  const alpha = 0.03 + Math.sin(tick * 0.1 + x * 0.01) * 0.01;
  const grad = ctx.createRadialGradient(x, y + 120, 0, x, y + 120, 80);
  grad.addColorStop(0, `rgba(240, 232, 208, ${alpha})`);
  grad.addColorStop(1, "rgba(240, 232, 208, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(x - 80, y + 40, 160, 160);
}

export function drawBookcase(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 2) {
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x, y, 16 * s, 20 * s);
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(x + s, y + s, 14 * s, 18 * s);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = "#5c4a3a";
    ctx.fillRect(x + s, y + (1 + i * 5) * s, 14 * s, s);
    const colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];
    for (let b = 0; b < 5; b++) {
      ctx.fillStyle = colors[(i * 5 + b) % colors.length];
      ctx.fillRect(x + (2 + b * 2.5) * s, y + (2 + i * 5) * s, 2 * s, 3.5 * s);
    }
  }
}

export function drawPrinter(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 2) {
  ctx.fillStyle = "#555";
  ctx.fillRect(x, y, 10 * s, 6 * s);
  ctx.fillStyle = "#444";
  ctx.fillRect(x + s, y + s, 8 * s, 3 * s);
  ctx.fillStyle = "#eee";
  ctx.fillRect(x + 2 * s, y - s, 6 * s, s);
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(x + 8 * s, y + 5 * s, s, s);
}

export function drawWaterCooler(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 2) {
  ctx.fillStyle = "#a8d8ea";
  ctx.fillRect(x + 2 * s, y, 4 * s, 6 * s);
  ctx.fillStyle = "#87ceeb50";
  ctx.fillRect(x + 3 * s, y + s, 2 * s, 4 * s);
  ctx.fillStyle = "#ddd";
  ctx.fillRect(x, y + 6 * s, 8 * s, 10 * s);
  ctx.fillStyle = "#ccc";
  ctx.fillRect(x + s, y + 7 * s, 6 * s, 4 * s);
  ctx.fillStyle = "#888";
  ctx.fillRect(x + 3 * s, y + 12 * s, 2 * s, s);
  ctx.fillStyle = "#aaa";
  ctx.fillRect(x + s, y + 16 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 5 * s, y + 16 * s, 2 * s, 2 * s);
}

export function drawCoatRack(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 2) {
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x + 3 * s, y + 4 * s, 2 * s, 14 * s);
  ctx.fillStyle = "#6b5a4a";
  ctx.fillRect(x + 2 * s, y + 3 * s, 4 * s, 2 * s);
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(x, y + 5 * s, 2 * s, s);
  ctx.fillRect(x + 6 * s, y + 5 * s, 2 * s, s);
  ctx.fillStyle = "#2a4a6a";
  ctx.fillRect(x - s, y + 6 * s, 4 * s, 6 * s);
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x + s, y + 18 * s, 6 * s, s);
}

export function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 3) {
  ctx.fillStyle = "#8B5E3C";
  ctx.fillRect(x + 2 * s, y + 8 * s, 6 * s, 5 * s);
  ctx.fillStyle = "#6B4226";
  ctx.fillRect(x + s, y + 7 * s, 8 * s, 2 * s);
  ctx.fillStyle = "#4a3020";
  ctx.fillRect(x + 2 * s, y + 7 * s, 6 * s, s);
  ctx.fillStyle = "#2d8a4e";
  ctx.beginPath(); ctx.arc(x + 5 * s, y + 4 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3cb371";
  ctx.beginPath(); ctx.arc(x + 3 * s, y + 3 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 7 * s, y + 3 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3aaa5e";
  ctx.beginPath(); ctx.arc(x + 5 * s, y + 2 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
}

export function drawCoffeeMachine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 3) {
  ctx.fillStyle = "#555";
  ctx.fillRect(x, y + 2 * s, 8 * s, 12 * s);
  ctx.fillStyle = "#444";
  ctx.fillRect(x + s, y + 3 * s, 6 * s, 6 * s);
  ctx.fillStyle = "#333";
  ctx.fillRect(x + 2 * s, y + 5 * s, 4 * s, 3 * s);
  ctx.fillStyle = "#666";
  ctx.fillRect(x, y, 8 * s, 2 * s);
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 6 * s, y + 10 * s, s, s);
  ctx.fillStyle = "#444";
  ctx.fillRect(x + s, y + 12 * s, 6 * s, s);
}

export function drawCoffeeTable(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 3) {
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x, y, 10 * s, 6 * s);
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(x, y + 6 * s, 10 * s, s);
  ctx.fillRect(x + s, y + 7 * s, s, 3 * s);
  ctx.fillRect(x + 8 * s, y + 7 * s, s, 3 * s);
}

export function drawBench(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: number = 3) {
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x, y, w, 3 * s);
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(x + s, y + 3 * s, s, 2 * s);
  ctx.fillRect(x + w - 2 * s, y + 3 * s, s, 2 * s);
}

export function drawMeetingTable(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 3) {
  ctx.fillStyle = "#5c4a3a";
  ctx.fillRect(x, y, 16 * s, 10 * s);
  ctx.fillStyle = "#4a3828";
  ctx.fillRect(x + s, y + 10 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 13 * s, y + 10 * s, 2 * s, 2 * s);
  const cc = "#3a3a4a";
  ctx.fillStyle = cc;
  ctx.fillRect(x + 3 * s, y - 3 * s, 4 * s, 3 * s);
  ctx.fillRect(x + 9 * s, y - 3 * s, 4 * s, 3 * s);
  ctx.fillRect(x + 3 * s, y + 10 * s, 4 * s, 3 * s);
  ctx.fillRect(x + 9 * s, y + 10 * s, 4 * s, 3 * s);
  ctx.fillRect(x - 3 * s, y + 3 * s, 3 * s, 4 * s);
  ctx.fillRect(x + 16 * s, y + 3 * s, 3 * s, 4 * s);
}

export function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 2) {
  ctx.fillStyle = "#aaa";
  ctx.fillRect(x, y, 18 * s, 12 * s);
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(x + s, y + s, 16 * s, 10 * s);
  ctx.fillStyle = "#23C6B7";
  ctx.fillRect(x + 2 * s, y + 3 * s, 6 * s, s);
  ctx.fillRect(x + 2 * s, y + 5 * s, 10 * s, s);
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 10 * s, y + 3 * s, 4 * s, s);
  ctx.fillRect(x + 2 * s, y + 7 * s, 5 * s, s);
  ctx.fillStyle = "#888";
  ctx.fillRect(x + 8 * s, y + 12 * s, 2 * s, 4 * s);
}

// Legacy exports
export function drawFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#1e2a35"; ctx.fillRect(x, y, size, size);
}
export function makeDesk(): string[][] { return []; }
export function makeChair(): string[][] { return []; }
export function makePlant(): string[][] { return []; }
export function makeCoffeeMachine(): string[][] { return []; }
export function makeWhiteboard(): string[][] { return []; }
export function makeTypingHands(): string[][] { return []; }

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.substring(0, 2), 16) || 0}, ${parseInt(h.substring(2, 4), 16) || 0}, ${parseInt(h.substring(4, 6), 16) || 0}`;
}
