import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { renderCoil } from "./render";

export const BACKGROUND = "#080f18";
export interface CoilSnapshot {
  version: number;
  screen: C.Screen;
  menuIndex: number;
  titleIndex: number;
  mode: typeof C.MODE;
  score: number;
  best: number;
  combo: number;
  comboWindow: number;
  muted: boolean;
  ticks: number;
  simTime: number;
  dir: C.Direction;
  turns: C.Direction[];
  snake: C.Cell[];
  pellet: C.Cell | null;
  obstacles: C.Cell[];
  steering: boolean;
  travel: boolean;
  pelletRespawn: boolean;
  nextPellet: C.Cell | null;
}
export interface CoilState extends CoilSnapshot {
  accumulator: number;
  bite: number;
  burst: { cell: C.Cell; time: number; points: number } | null;
  pointerDown: Record<number, { screen: C.Screen; index: number }>;
  sprites: {
    head: ImageBitmap[];
    body: ImageBitmap;
    corner: ImageBitmap;
    tail: ImageBitmap;
  };
}
type State = DeepReadonly<CoilState>;
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface CoilDebugApi {
  version: number;
  reset(s: State): CoilState;
  reconcile(s: State): CoilState;
  snapshot(s: State): CoilSnapshot;
  menuItemRect(s: State, index: number): Rect | null;
  setScreen(s: State, screen: C.Screen): CoilState;
  setMenuIndex(s: State, index: number): CoilState;
  setScore(s: State, points: number): CoilState;
  setBest(s: State, points: number): CoilState;
  setCombo(s: State, multiplier: number): CoilState;
  setComboWindow(s: State, seconds: number): CoilState;
  setSnake(s: State, cells: readonly C.Cell[]): CoilState;
  setDirection(s: State, dir: C.Direction): CoilState;
  clearTurns(s: State): CoilState;
  setSnakeSteering(s: State, enabled: boolean): CoilState;
  setSnakeTravel(s: State, enabled: boolean): CoilState;
  setPellet(s: State, col: number, row: number): CoilState;
  clearPellet(s: State): CoilState;
  setPelletRespawn(s: State, enabled: boolean): CoilState;
  setNextPellet(s: State, col: number, row: number): CoilState;
  drawPelletCell(s: State): C.Cell | null;
}
export function copy(s: State): CoilState {
  return {
    ...s,
    pellet: s.pellet ? { ...s.pellet } : null,
    nextPellet: s.nextPellet ? { ...s.nextPellet } : null,
    snake: s.snake.map((c) => ({ ...c })),
    turns: [...s.turns],
    obstacles: s.obstacles.map((c) => ({ ...c })),
    pointerDown: { ...s.pointerDown },
    sprites: { ...s.sprites, head: [...s.sprites.head] },
  };
}
function opening(sprites: CoilState["sprites"], muted = false): CoilState {
  return {
    version: C.COIL_DEBUG_VERSION,
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    mode: C.MODE,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted,
    ticks: 0,
    simTime: 0,
    dir: C.START_DIR,
    turns: [],
    snake: C.START_CELLS.map((c) => ({ ...c })),
    pellet: null,
    obstacles: [...C.OBSTACLE_CELLS],
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    accumulator: 0,
    bite: 0,
    burst: null,
    pointerDown: {},
    sprites,
  };
}
export function menuItems(screen: C.Screen): readonly string[] {
  if (screen === "title") return C.TITLE_ITEMS;
  if (screen === "paused") return C.PAUSE_ITEMS;
  if (screen === "gameover" || screen === "cleared") return C.OVER_ITEMS;
  if (screen === "howto") return ["BACK"];
  return [];
}
export function menuItemRect(
  s: Pick<CoilSnapshot, "screen">,
  index: number,
): Rect | null {
  if (index < 0 || !Number.isInteger(index))
    throw new RangeError("Invalid menu index");
  if (index >= menuItems(s.screen).length) return null;
  const y =
    s.screen === "howto"
      ? 594
      : s.screen === "title"
        ? 422
        : s.screen === "paused"
          ? 358
          : 432;
  return { x: C.STAGE_CX - 180, y: y + index * 66, w: 360, h: 52 };
}
const same = (a: C.Cell, b: C.Cell): boolean =>
  a.col === b.col && a.row === b.row;
function interior(c: C.Cell): boolean {
  return (
    Number.isInteger(c.col) &&
    Number.isInteger(c.row) &&
    c.col >= C.INTERIOR_MIN_COL &&
    c.col <= C.INTERIOR_MAX_COL &&
    c.row >= C.INTERIOR_MIN_ROW &&
    c.row <= C.INTERIOR_MAX_ROW
  );
}
function validCells(s: State): C.Cell[] {
  const cells: C.Cell[] = [];
  for (let row = C.INTERIOR_MIN_ROW; row <= C.INTERIOR_MAX_ROW; row++)
    for (let col = C.INTERIOR_MIN_COL; col <= C.INTERIOR_MAX_COL; col++) {
      const cell = { col, row };
      if (
        !s.snake.some((c) => same(c, cell)) &&
        !s.obstacles.some((c) => same(c, cell)) &&
        (!s.pellet || !same(s.pellet, cell))
      )
        cells.push(cell);
    }
  return cells;
}
function drawPelletCell(s: State): C.Cell | null {
  const cells = validCells(s);
  return cells.length
    ? { ...cells[Math.floor(Math.random() * cells.length)] }
    : null;
}
function spawn(s: CoilState): CoilState {
  const cells = validCells(s);
  const posed = s.nextPellet && cells.find((c) => same(c, s.nextPellet!));
  return {
    ...s,
    pellet: posed
      ? { ...posed }
      : cells.length
        ? cells[Math.floor(Math.random() * cells.length)]
        : null,
    nextPellet: null,
  };
}
function check(ok: boolean, message = "Invalid debug argument"): void {
  if (!ok) throw new RangeError(message);
}
function number(n: number, min: number, max = Infinity, whole = true): void {
  check(
    Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (!whole || Number.isInteger(n)),
  );
}
function flag(
  s: State,
  key: "steering" | "travel" | "pelletRespawn",
  enabled: boolean,
): CoilState {
  check(typeof enabled === "boolean");
  return {
    ...copy(s),
    [key]: enabled,
    ...(key === "steering" && !enabled ? { turns: [] } : {}),
  };
}
export const debug: CoilDebugApi = {
  version: C.COIL_DEBUG_VERSION,
  reset: (s) => opening(copy(s).sprites, s.muted),
  reconcile: copy,
  snapshot: (s) => {
    const {
      accumulator: _a,
      bite: _b,
      burst: _c,
      sprites: _d,
      pointerDown: _e,
      ...snapshot
    } = copy(s);
    return snapshot;
  },
  menuItemRect,
  setScreen: (s, screen) => {
    check(C.SCREENS.includes(screen));
    return { ...copy(s), screen };
  },
  setMenuIndex: (s, menuIndex) => {
    number(menuIndex, 0, Math.max(0, menuItems(s.screen).length - 1));
    return { ...copy(s), menuIndex };
  },
  setScore: (s, score) => {
    number(score, 0);
    return { ...copy(s), score };
  },
  setBest: (s, best) => {
    number(best, 0);
    return { ...copy(s), best };
  },
  setCombo: (s, combo) => {
    number(combo, 1, C.COMBO_MAX);
    return { ...copy(s), combo };
  },
  setComboWindow: (s, comboWindow) => {
    number(comboWindow, 0, C.COMBO_WINDOW, false);
    return { ...copy(s), comboWindow };
  },
  setSnake: (s, cells) => {
    check(cells.length > 0);
    cells.forEach((c, i) => {
      check(interior(c) && !s.obstacles.some((o) => same(o, c)));
      check(!cells.slice(0, i).some((p) => same(p, c)));
      if (i)
        check(
          Math.abs(c.col - cells[i - 1].col) +
            Math.abs(c.row - cells[i - 1].row) ===
            1,
        );
    });
    return { ...copy(s), snake: cells.map((c) => ({ ...c })) };
  },
  setDirection: (s, dir) => {
    check(C.DIRECTIONS.includes(dir));
    return { ...copy(s), dir };
  },
  clearTurns: (s) => ({ ...copy(s), turns: [] }),
  setSnakeSteering: (s, enabled) => flag(s, "steering", enabled),
  setSnakeTravel: (s, enabled) => flag(s, "travel", enabled),
  setPellet: (s, col, row) => {
    const pellet = { col, row };
    check(
      interior(pellet) &&
        !s.snake.some((c) => same(c, pellet)) &&
        !s.obstacles.some((c) => same(c, pellet)),
    );
    return { ...copy(s), pellet };
  },
  clearPellet: (s) => ({ ...copy(s), pellet: null }),
  setPelletRespawn: (s, enabled) => flag(s, "pelletRespawn", enabled),
  setNextPellet: (s, col, row) => {
    number(col, 0, C.GRID_COLS - 1);
    number(row, 0, C.GRID_ROWS - 1);
    return { ...copy(s), nextPellet: { col, row } };
  },
  drawPelletCell,
};
const vectors: Record<C.Direction, readonly [number, number]> = {
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
  up: [0, -1],
};
function arrive(s: CoilState, screen: C.Screen): CoilState {
  return {
    ...s,
    screen,
    menuIndex: screen === "title" ? s.titleIndex : 0,
    pointerDown: {},
  };
}
function begin(s: CoilState, api: UpdateApi): CoilState {
  api.audio.loop(C.CUES.music);
  const fresh = {
    ...opening(s.sprites, s.muted),
    best: s.best,
    titleIndex: s.titleIndex,
    ticks: s.ticks,
    simTime: s.simTime,
    nextPellet: s.nextPellet,
  };
  return arrive(spawn(fresh), "playing");
}
function accept(s: CoilState, api: UpdateApi): CoilState {
  if (s.screen === "title") {
    s = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 0 ? begin(s, api) : arrive(s, "howto");
  }
  if (s.screen === "howto") return arrive(s, "title");
  if (s.screen === "paused") {
    if (s.menuIndex === 0) return arrive(s, "playing");
    if (s.menuIndex === 1) return begin(s, api);
  } else if (
    (s.screen === "gameover" || s.screen === "cleared") &&
    s.menuIndex === 0
  )
    return begin(s, api);
  api.audio.stop(C.CUES.music);
  return arrive(s, "title");
}
function tick(s: CoilState, api: UpdateApi): CoilState {
  s = { ...s, ticks: s.ticks + 1 };
  if (s.steering && s.turns.length) {
    const [turn, ...turns] = s.turns;
    const horizontal = (d: C.Direction): boolean =>
      d === "left" || d === "right";
    s = {
      ...s,
      turns,
      dir: horizontal(turn) !== horizontal(s.dir) ? turn : s.dir,
    };
  }
  if (s.travel) {
    const [dx, dy] = vectors[s.dir];
    const head = { col: s.snake[0].col + dx, row: s.snake[0].row + dy };
    const eat = s.pellet !== null && same(head, s.pellet);
    if (
      !interior(head) ||
      s.obstacles.some((c) => same(c, head)) ||
      s.snake.slice(0, eat ? s.snake.length : -1).some((c) => same(c, head))
    ) {
      api.audio.play(C.CUES.death);
      api.audio.stop(C.CUES.music);
      return { ...arrive(s, "gameover"), accumulator: 0 };
    }
    s = { ...s, snake: [head, ...s.snake.slice(0, eat ? s.snake.length : -1)] };
    if (eat) {
      const combo = s.comboWindow > 0 ? Math.min(C.COMBO_MAX, s.combo + 1) : 1;
      api.audio.play(C.CUES.eat);
      if (combo > s.combo) api.audio.play(C.CUES.comboUp);
      const score = s.score + C.PELLET_POINTS * combo;
      s = {
        ...s,
        score,
        best: Math.max(s.best, score),
        combo,
        comboWindow: C.COMBO_WINDOW,
        bite: C.BITE_SECONDS,
        burst: { cell: head, time: 0.6, points: C.PELLET_POINTS * combo },
      };
      if (s.pelletRespawn) {
        s = spawn(s);
        if (!s.pellet) {
          api.audio.stop(C.CUES.music);
          s = { ...arrive(s, "cleared"), accumulator: 0 };
        }
      } else s = { ...s, pellet: null };
    }
  }
  const comboWindow = Math.max(0, s.comboWindow - C.TICK_SECONDS);
  return { ...s, comboWindow, combo: comboWindow === 0 ? 1 : s.combo };
}
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    const paths = [
      ...C.SPRITE_PATHS.head,
      C.SPRITE_PATHS.body,
      C.SPRITE_PATHS.corner,
      C.SPRITE_PATHS.tail,
    ];
    const [images] = await Promise.all([
      Promise.all(paths.map((p) => api.assets.loadImage(p))),
      Promise.all(
        Object.values(C.CUES).map((cue) =>
          api.audio.load(cue, C.CUE_PATHS[cue]),
        ),
      ),
    ]);
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("score / best", (s) => `${s.score} / ${s.best}`);
    api.diagnostics.register(
      "combo / seconds",
      (s) => `x${s.combo} / ${s.comboWindow.toFixed(3)}`,
    );
    api.diagnostics.register(
      "direction / length",
      (s) => `${s.dir} / ${s.snake.length}`,
    );
    api.diagnostics.register(
      "head",
      (s) => `${s.snake[0].col}, ${s.snake[0].row}`,
    );
    api.diagnostics.register("pellet", (s) =>
      s.pellet ? `${s.pellet.col}, ${s.pellet.row}` : "none",
    );
    return [
      opening({
        head: images.slice(0, C.HEAD_FRAMES),
        body: images[C.HEAD_FRAMES],
        corner: images[C.HEAD_FRAMES + 1],
        tail: images[C.HEAD_FRAMES + 2],
      }),
      debug,
    ];
  },
  update(state, api, dt) {
    let s = copy(state);
    const pressed = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
    ) as Record<C.ActionName, boolean>;
    const samples = api.input.pointerSamples();
    if (pressed.mute) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    s.best = Math.max(s.best, s.score);
    const wasPlaying = state.screen === "playing";
    if (wasPlaying) {
      if (pressed.pause || pressed.back) s = arrive(s, "paused");
      else if (s.steering)
        for (const dir of C.DIRECTIONS)
          if (pressed[dir] && s.turns.length < C.TURN_QUEUE_MAX)
            s.turns.push(dir);
    } else {
      const items = menuItems(s.screen);
      if (pressed.up)
        s.menuIndex = (s.menuIndex + items.length - 1) % items.length;
      if (pressed.down) s.menuIndex = (s.menuIndex + 1) % items.length;
      if (pressed.back || (pressed.pause && s.screen === "paused")) {
        if (s.screen === "paused") s = arrive(s, "playing");
        else if (s.screen !== "title") {
          api.audio.stop(C.CUES.music);
          s = arrive(s, "title");
        }
      } else if (pressed.confirm) s = accept(s, api);
      for (const p of samples) {
        if (s.screen === "playing") break;
        let index = -1;
        menuItems(s.screen).forEach((_, i) => {
          const r = menuItemRect(s, i)!;
          if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h)
            index = i;
        });
        if (index >= 0) s.menuIndex = index;
        if (p.type === "down" && p.button === "primary")
          s.pointerDown[p.id] = { screen: s.screen, index };
        if (p.type === "up" && p.button === "primary") {
          const down = s.pointerDown[p.id];
          delete s.pointerDown[p.id];
          if (index >= 0 && down?.screen === s.screen && down.index === index)
            s = accept(s, api);
        }
      }
    }
    if (wasPlaying && s.screen === "playing") {
      s.simTime += dt;
      let remaining = dt;
      // Advance drawing effects to each tick boundary as well. A bite that
      // begins early in a long frame must age for the rest of that frame.
      while (remaining > 1e-10 && s.screen === "playing") {
        const step = Math.min(remaining, C.TICK_SECONDS - s.accumulator);
        s.bite = Math.max(0, s.bite - step);
        if (s.burst)
          s.burst =
            s.burst.time > step
              ? { ...s.burst, time: s.burst.time - step }
              : null;
        s.accumulator += step;
        remaining -= step;
        if (s.accumulator + 1e-10 >= C.TICK_SECONDS) {
          s.accumulator = Math.max(0, s.accumulator - C.TICK_SECONDS);
          s = tick(s, api);
        }
      }
      if (s.screen !== "playing") s.accumulator = 0;
    }
    if (s.screen !== "playing" && s.screen !== "paused")
      api.audio.stop(C.CUES.music);
    return s;
  },
  render: renderCoil,
};
