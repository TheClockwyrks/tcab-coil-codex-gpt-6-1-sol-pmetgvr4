import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { menuItems, menuItemRect, type CoilState } from "./game";
const mint = "#80ffce";
const white = "#e9f5f2";
const muted = "#698b95";
const amber = "#ffbd69";
type State = DeepReadonly<CoilState>;
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = white,
  align: CanvasTextAlign = "left",
  bold = false,
): void {
  ctx.font = `${bold ? "700" : "400"} ${size}px ${bold ? "Arial, sans-serif" : "monospace"}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function sprite(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  angle = 0,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.drawImage(image, -C.CELL / 2, -C.CELL / 2, C.CELL, C.CELL);
  ctx.restore();
}
function snake(ctx: CanvasRenderingContext2D, s: State): void {
  const angles = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
  };
  s.snake.forEach((cell, i) => {
    let image = s.sprites.body;
    let angle = 0;
    const before = s.snake[i - 1];
    const after = s.snake[i + 1];
    if (i === 0) {
      const frame =
        s.bite > 0
          ? Math.min(
              C.HEAD_FRAMES - 1,
              1 +
                Math.floor((1 - s.bite / C.BITE_SECONDS) * (C.HEAD_FRAMES - 1)),
            )
          : 0;
      image = s.sprites.head[frame];
      angle = angles[s.dir];
    } else if (!after) {
      image = s.sprites.tail;
      angle = Math.atan2(before.row - cell.row, before.col - cell.col);
    } else if (before.col === after.col) angle = Math.PI / 2;
    else if (before.row !== after.row) {
      image = s.sprites.corner;
      const dirs = [before, after].map((c) => ({
        x: c.col - cell.col,
        y: c.row - cell.row,
      }));
      const right = dirs.some((d) => d.x === 1);
      const down = dirs.some((d) => d.y === 1);
      angle =
        right && down ? 0 : down ? Math.PI / 2 : right ? -Math.PI / 2 : Math.PI;
    }
    ctx.shadowColor = "#24d59b";
    ctx.shadowBlur = i === 0 ? 15 : 5;
    sprite(
      ctx,
      image,
      C.BOARD_X + cell.col * C.CELL + C.CELL / 2,
      C.BOARD_Y + cell.row * C.CELL + C.CELL / 2,
      angle,
    );
  });
  ctx.shadowBlur = 0;
}
function pellet(
  ctx: CanvasRenderingContext2D,
  cell: C.Cell,
  time: number,
): void {
  const x = C.BOARD_X + (cell.col + 0.5) * C.CELL;
  const y = C.BOARD_Y + (cell.row + 0.5) * C.CELL;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#765438";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 13 + Math.sin(time * 5), 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = amber;
  ctx.shadowBlur = 18;
  ctx.fillStyle = amber;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff1c8";
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
}
function board(ctx: CanvasRenderingContext2D, s: State): void {
  const w = C.GRID_COLS * C.CELL;
  const h = C.GRID_ROWS * C.CELL;
  ctx.fillStyle = "#101f2a";
  ctx.fillRect(C.BOARD_X, C.BOARD_Y, w, h);
  ctx.fillStyle = "#0b1720";
  ctx.fillRect(
    C.BOARD_X + C.CELL,
    C.BOARD_Y + C.CELL,
    w - C.CELL * 2,
    h - C.CELL * 2,
  );
  ctx.strokeStyle = "#173039";
  ctx.strokeRect(C.BOARD_X + 0.5, C.BOARD_Y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = "#2e5c61";
  ctx.strokeRect(
    C.BOARD_X + C.CELL + 0.5,
    C.BOARD_Y + C.CELL + 0.5,
    w - C.CELL * 2 - 1,
    h - C.CELL * 2 - 1,
  );
  for (let col = 1; col < C.GRID_COLS; col++) {
    const x = C.BOARD_X + col * C.CELL;
    line(ctx, x, C.BOARD_Y + C.CELL, x, C.BOARD_Y + h - C.CELL, "#142630");
    if (col % 2 === 0) {
      ctx.fillStyle = "#346268";
      ctx.fillRect(x + 13, C.BOARD_Y + 14, 6, 2);
      ctx.fillRect(x + 13, C.BOARD_Y + h - 16, 6, 2);
    }
  }
  for (let row = 1; row < C.GRID_ROWS; row++) {
    const y = C.BOARD_Y + row * C.CELL;
    line(ctx, C.BOARD_X + C.CELL, y, C.BOARD_X + w - C.CELL, y, "#142630");
    if (row % 2 === 0) {
      ctx.fillStyle = "#346268";
      ctx.fillRect(C.BOARD_X + 14, y + 13, 2, 6);
      ctx.fillRect(C.BOARD_X + w - 16, y + 13, 2, 6);
    }
  }
  for (const [x, y, dx, dy] of [
    [C.BOARD_X, C.BOARD_Y, 1, 1],
    [C.BOARD_X + w, C.BOARD_Y, -1, 1],
    [C.BOARD_X, C.BOARD_Y + h, 1, -1],
    [C.BOARD_X + w, C.BOARD_Y + h, -1, -1],
  ]) {
    line(ctx, x, y, x + dx * 24, y, mint);
    line(ctx, x, y, x, y + dy * 24, mint);
  }
  s.obstacles.forEach((c) => {
    ctx.fillStyle = "#52676c";
    ctx.fillRect(
      C.BOARD_X + c.col * C.CELL,
      C.BOARD_Y + c.row * C.CELL,
      C.CELL,
      C.CELL,
    );
  });
  if (s.pellet) pellet(ctx, s.pellet, s.simTime);
  snake(ctx, s);
  if (s.burst) {
    const elapsed = 0.6 - s.burst.time;
    const x = C.BOARD_X + (s.burst.cell.col + 0.5) * C.CELL;
    const y = C.BOARD_Y + (s.burst.cell.row + 0.5) * C.CELL;
    ctx.save();
    ctx.globalAlpha = s.burst.time / 0.6;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const r = 10 + elapsed * 100;
      ctx.fillStyle = i % 2 ? amber : mint;
      ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 3, 3);
    }
    text(
      ctx,
      `+${s.burst.points}`,
      x,
      y - 25 - elapsed * 35,
      16,
      amber,
      "center",
      true,
    );
    ctx.restore();
  }
}
function hud(ctx: CanvasRenderingContext2D, s: State): void {
  text(ctx, C.TITLE_TEXT, C.BOARD_X, 55, 28, mint, "left", true);
  text(ctx, C.MODE_LABEL, C.BOARD_X, 79, 11, muted);
  text(ctx, C.SCORE_LABEL, 360, 38, 12, muted);
  text(ctx, String(s.score).padStart(4, "0"), 360, 78, 36, white, "left", true);
  text(ctx, C.BEST_LABEL, 548, 38, 12, muted);
  text(ctx, String(s.best).padStart(4, "0"), 548, 78, 36, white, "left", true);
  if (s.combo >= 2) {
    text(ctx, `x${s.combo}`, 754, 65, 36, amber, "left", true);
    ctx.fillStyle = "#342c25";
    ctx.fillRect(754, 78, 170, 4);
    ctx.fillStyle = amber;
    ctx.fillRect(754, 78, (170 * s.comboWindow) / C.COMBO_WINDOW, 4);
    text(ctx, "COMBO", 812, 61, 11, amber);
  }
  text(
    ctx,
    s.muted ? "M / SOUND OFF" : "M / SOUND ON",
    C.BOARD_X + C.GRID_COLS * C.CELL,
    46,
    12,
    s.muted ? amber : muted,
    "right",
  );
  text(
    ctx,
    "P / PAUSE",
    C.BOARD_X + C.GRID_COLS * C.CELL,
    76,
    12,
    muted,
    "right",
  );
  line(ctx, C.BOARD_X, 101, C.BOARD_X + C.GRID_COLS * C.CELL, 101, "#22333e");
  ctx.save();
  ctx.translate(125, 400);
  ctx.rotate(-Math.PI / 2);
  text(ctx, "KEEP MOVING. STAY CONNECTED.", 0, 0, 10, "#3e5a66", "center");
  ctx.restore();
  ctx.save();
  ctx.translate(1156, 400);
  ctx.rotate(Math.PI / 2);
  text(
    ctx,
    "30 × 18  /  EIGHT TICKS PER SECOND",
    0,
    0,
    10,
    "#3e5a66",
    "center",
  );
  ctx.restore();
}
function menu(ctx: CanvasRenderingContext2D, s: State): void {
  menuItems(s.screen).forEach((item, i) => {
    const r = menuItemRect(s, i)!;
    const selected = i === s.menuIndex;
    ctx.fillStyle = selected ? mint : "#142630";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = selected ? "#c6ffe8" : "#2d454f";
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    text(
      ctx,
      item,
      r.x + 26,
      r.y + 33,
      16,
      selected ? "#07251f" : "#aac0c6",
      "left",
      true,
    );
    text(
      ctx,
      selected ? "↗" : "—",
      r.x + r.w - 24,
      r.y + 34,
      22,
      selected ? "#07251f" : "#526f78",
      "right",
    );
  });
}
export function renderCoil(s: State, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  hud(ctx, s);
  board(ctx, s);
  if (s.screen === "playing") return;
  ctx.fillStyle =
    s.screen === "title" || s.screen === "howto" ? "#080f18ee" : "#080f18bb";
  ctx.fillRect(
    C.BOARD_X + C.CELL,
    C.BOARD_Y + C.CELL,
    (C.GRID_COLS - 2) * C.CELL,
    (C.GRID_ROWS - 2) * C.CELL,
  );
  if (s.screen === "title") {
    text(ctx, "01 / CLASSIC ARCADE", C.STAGE_CX, 194, 11, muted, "center");
    ctx.save();
    ctx.font = "italic 900 132px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#123d39";
    ctx.fillText(C.TITLE_TEXT, C.STAGE_CX + 5, 328);
    ctx.fillStyle = mint;
    ctx.shadowColor = "#25b38a";
    ctx.shadowBlur = 24;
    ctx.fillText(C.TITLE_TEXT, C.STAGE_CX, 321);
    ctx.restore();
    text(ctx, C.TAGLINE_TEXT, C.STAGE_CX, 358, 18, white, "center");
    text(
      ctx,
      "A quick mind. A continuous line.",
      C.STAGE_CX,
      390,
      13,
      muted,
      "center",
    );
    menu(ctx, s);
    text(
      ctx,
      `${C.BEST_LABEL}  ${String(s.best).padStart(4, "0")}`,
      C.STAGE_CX,
      587,
      13,
      amber,
      "center",
    );
    text(
      ctx,
      "↑ ↓ SELECT    ENTER START",
      C.STAGE_CX,
      622,
      11,
      muted,
      "center",
    );
    // The authored sprite set is also the title's living visual signature.
    for (let i = 0; i < 5; i++)
      sprite(
        ctx,
        i === 0 ? s.sprites.tail : s.sprites.body,
        367 + i * C.CELL,
        248,
      );
    sprite(ctx, s.sprites.corner, 527, 248, Math.PI);
    sprite(ctx, s.sprites.body, 527, 216, Math.PI / 2);
    sprite(ctx, s.sprites.head[0], 527, 184, -Math.PI / 2);
  } else if (s.screen === "howto") {
    text(ctx, "HOW TO PLAY", C.STAGE_CX, 213, 36, mint, "center", true);
    const rows = [
      [
        "01",
        "FOLLOW THE LINE",
        "The serpent never stops. Your turn lands on the next tick.",
      ],
      ["02", "THINK AHEAD", "Turn at right angles. You cannot double back."],
      [
        "03",
        "FEED THE COIL",
        "Amber pellets add one cell. Walls and your own body end the run.",
      ],
      [
        "04",
        "CHAIN YOUR ROUTE",
        "Eat quickly to build x5. Let the window expire and return to x1.",
      ],
    ];
    rows.forEach(([n, title, body], i) => {
      const y = 265 + i * 65;
      text(ctx, n, 278, y, 14, amber);
      text(ctx, title, 319, y, 15, white, "left", true);
      text(ctx, body, 319, y + 23, 12, muted);
    });
    line(ctx, 278, 511, 1002, 511, "#29424a");
    text(
      ctx,
      "ARROWS / WASD  STEER     ENTER / SPACE  CONFIRM",
      C.STAGE_CX,
      539,
      12,
      white,
      "center",
    );
    text(
      ctx,
      "ESC  BACK / PAUSE     P  PAUSE     M  MUTE",
      C.STAGE_CX,
      565,
      12,
      muted,
      "center",
    );
    menu(ctx, s);
  } else {
    ctx.fillStyle = "#0c1923f5";
    ctx.fillRect(408, 222, 464, s.screen === "paused" ? 376 : 365);
    ctx.strokeStyle = "#31545c";
    ctx.strokeRect(408.5, 222.5, 463, s.screen === "paused" ? 375 : 364);
    text(
      ctx,
      s.screen === "paused"
        ? "SIGNAL HELD"
        : s.screen === "cleared"
          ? "PERFECT CIRCUIT"
          : "CONNECTION LOST",
      C.STAGE_CX,
      261,
      11,
      amber,
      "center",
    );
    text(
      ctx,
      s.screen === "paused"
        ? "PAUSED"
        : s.screen === "cleared"
          ? C.CLEARED_TEXT
          : C.GAMEOVER_TEXT,
      C.STAGE_CX,
      310,
      36,
      white,
      "center",
      true,
    );
    if (s.screen === "paused")
      text(
        ctx,
        "Take a breath. The coil can wait.",
        C.STAGE_CX,
        335,
        12,
        muted,
        "center",
      );
    else {
      text(ctx, C.SCORE_LABEL, 538, 351, 11, muted, "center");
      text(ctx, String(s.score), 538, 395, 36, mint, "center", true);
      text(ctx, C.BEST_LABEL, 742, 351, 11, muted, "center");
      text(ctx, String(s.best), 742, 395, 36, amber, "center", true);
    }
    menu(ctx, s);
  }
}
