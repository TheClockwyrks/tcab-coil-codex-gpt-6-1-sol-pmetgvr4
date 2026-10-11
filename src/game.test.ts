/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import {
  createEngine,
  ConstantClock,
  type Engine,
} from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type CoilState, type CoilDebugApi } from "./game";
import * as C from "./constants";

let engine: Engine<CoilState, CoilDebugApi>;
let target: EventTarget;
let cues: string[];
function key(code: string): void {
  for (const type of ["keydown", "keyup"]) {
    const e = new Event(type);
    Object.assign(e, { code, repeat: false });
    target.dispatchEvent(e);
  }
}
function pointer(
  type: string,
  x: number,
  y: number,
  id = 1,
  device = "mouse",
): void {
  const e = new Event(`pointer${type}`);
  Object.assign(e, {
    clientX: x,
    clientY: y,
    pointerId: id,
    pointerType: device,
    isPrimary: true,
    button: 0,
    buttons: type === "up" ? 0 : 1,
  });
  target.dispatchEvent(e);
}
async function start(): Promise<void> {
  key("Enter");
  await engine.advance(1);
}
const snap = (): ReturnType<CoilDebugApi["snapshot"]> =>
  engine.debug.snapshot(engine.state);
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    async (url: string) =>
      new Response(new Uint8Array(await readFile(String(url)))),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(new Uint8Array(await blob.arrayBuffer())),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "suspended";
      decodeAudioData(): Promise<object> {
        return Promise.resolve({});
      }
      resume(): Promise<void> {
        return Promise.resolve();
      }
    },
  );
  target = new EventTarget();
  cues = [];
  engine = createEngine({
    canvas: createCanvas(C.STAGE_W, C.STAGE_H) as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    background: BACKGROUND,
    game,
    layout: C.LAYOUT,
    clock: new ConstantClock(C.TICK_SECONDS * 1000),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  await engine.initialize();
});
afterEach(() => {
  engine.destroy();
  vi.unstubAllGlobals();
});

describe("fixed-tick simulation", () => {
  it("opens on the title and starts a fresh classic round", async () => {
    expect(snap()).toMatchObject({
      screen: "title",
      score: 0,
      best: 0,
      pellet: null,
      ticks: 0,
      simTime: 0,
      mode: C.MODE,
    });
    engine.apply((s) => engine.debug.setNextPellet(s, 16, 8));
    await start();
    expect(snap()).toMatchObject({
      screen: "playing",
      snake: C.START_CELLS,
      dir: C.START_DIR,
      pellet: { col: 16, row: 8 },
      nextPellet: null,
    });
  });
  it("carries fractional time and resolves eight ticks in a second", async () => {
    await start();
    engine.apply((s) => engine.debug.clearPellet(s));
    engine.setClock(new ConstantClock(50));
    await engine.advance(2);
    expect(snap().ticks).toBe(0);
    await engine.advance(18);
    expect(snap()).toMatchObject({
      ticks: 8,
      simTime: expect.closeTo(1),
      snake: [
        { col: 23, row: 8 },
        { col: 22, row: 8 },
        { col: 21, row: 8 },
      ],
    });
  });
  it("ages a bite correctly inside a long frame without mutating prior state", async () => {
    await start();
    engine.apply((s) => engine.debug.setPellet(s, 16, 8));
    engine.apply((s) => engine.debug.setPelletRespawn(s, false));
    const prior = engine.state;
    engine.setClock(new ConstantClock(1000));
    await engine.advance(1);
    expect(snap()).toMatchObject({ ticks: 8, score: 10, pellet: null });
    expect(engine.state.bite).toBe(0);
    expect(engine.state.burst).toBeNull();
    expect(prior.snake).toEqual(C.START_CELLS);
    expect(prior.score).toBe(0);
  });
  it("grows, scores, reopens the window, and emits exactly the eat cues", async () => {
    await start();
    engine.apply((s) => engine.debug.setPellet(s, 16, 8));
    engine.apply((s) => engine.debug.setNextPellet(s, 17, 8));
    await engine.advance(1);
    expect(snap()).toMatchObject({
      score: 10,
      best: 10,
      combo: 1,
      comboWindow: C.COMBO_WINDOW - C.TICK_SECONDS,
    });
    expect(snap().snake).toHaveLength(4);
    expect(cues).toEqual([C.CUES.eat]);
    await engine.advance(1);
    expect(snap()).toMatchObject({ score: 30, best: 30, combo: 2 });
    expect(cues).toEqual([C.CUES.eat, C.CUES.eat, C.CUES.comboUp]);
  });
  it("caps the multiplier and lapses exactly after 28 ticks", async () => {
    await start();
    engine.apply((s) => engine.debug.setCombo(s, C.COMBO_MAX));
    engine.apply((s) => engine.debug.setComboWindow(s, C.COMBO_WINDOW));
    engine.apply((s) => engine.debug.setPellet(s, 16, 8));
    await engine.advance(1);
    expect(snap().score).toBe(50);
    expect(cues).toEqual([C.CUES.eat]);
    engine.apply((s) => engine.debug.setSnakeTravel(s, false));
    await engine.advance(26);
    expect(snap().combo).toBe(C.COMBO_MAX);
    await engine.advance(1);
    expect(snap()).toMatchObject({ combo: 1, comboWindow: 0 });
  });
  it("buffers two perpendicular turns across two ticks and discards overflow", async () => {
    await start();
    engine.apply((s) => engine.debug.clearPellet(s));
    engine.setClock({ delta: () => 0 });
    key("ArrowDown");
    await engine.advance(1);
    key("ArrowLeft");
    await engine.advance(1);
    key("ArrowUp");
    await engine.advance(1);
    expect(snap().turns).toEqual(["down", "left"]);
    engine.setClock(new ConstantClock(125));
    await engine.advance(1);
    expect(snap()).toMatchObject({ dir: "down", turns: ["left"] });
    await engine.advance(1);
    expect(snap()).toMatchObject({
      dir: "left",
      turns: [],
      snake: [
        { col: 14, row: 9 },
        { col: 15, row: 9 },
        { col: 15, row: 8 },
      ],
    });
  });
  it("discards reversals and repeats one at a time", async () => {
    await start();
    key("ArrowLeft");
    await engine.advance(1);
    expect(snap().dir).toBe("right");
    key("ArrowRight");
    await engine.advance(1);
    expect(snap().snake[0]).toEqual({ col: 17, row: 8 });
  });
  it("permits entering the vacating tail", async () => {
    await start();
    engine.apply((s) => engine.debug.clearPellet(s));
    engine.apply((s) =>
      engine.debug.setSnake(s, [
        { col: 5, row: 5 },
        { col: 5, row: 6 },
        { col: 6, row: 6 },
        { col: 6, row: 5 },
      ]),
    );
    await engine.advance(1);
    expect(snap()).toMatchObject({
      screen: "playing",
      snake: [
        { col: 6, row: 5 },
        { col: 5, row: 5 },
        { col: 5, row: 6 },
        { col: 6, row: 6 },
      ],
    });
  });
  it("kills a collision with the body before scoring or moving", async () => {
    await start();
    engine.apply((s) =>
      engine.debug.setSnake(s, [
        { col: 5, row: 5 },
        { col: 6, row: 5 },
        { col: 6, row: 6 },
      ]),
    );
    const chain = snap().snake;
    await engine.advance(1);
    expect(snap()).toMatchObject({
      screen: "gameover",
      score: 0,
      snake: chain,
      ticks: 1,
    });
    expect(cues).toEqual([C.CUES.death]);
  });
  it("spends excess time after a fatal tick", async () => {
    await start();
    engine.apply((s) => engine.debug.setSnake(s, [{ col: 28, row: 8 }]));
    engine.setClock(new ConstantClock(1000));
    await engine.advance(1);
    expect(snap()).toMatchObject({ screen: "gameover", ticks: 1 });
    expect(engine.state.accumulator).toBe(0);
    engine.apply((s) => engine.debug.setScreen(s, "playing"));
    engine.apply((s) => engine.debug.setSnakeTravel(s, false));
    engine.setClock(new ConstantClock(25));
    await engine.advance(1);
    expect(snap().ticks).toBe(1);
  });
  it("drains the combo with travel disabled and consumes steering independently", async () => {
    await start();
    engine.apply((s) => engine.debug.setSnakeTravel(s, false));
    engine.apply((s) => engine.debug.setComboWindow(s, 1));
    key("ArrowDown");
    await engine.advance(1);
    expect(snap()).toMatchObject({
      snake: C.START_CELLS,
      dir: "down",
      comboWindow: 0.875,
    });
    engine.apply((s) => engine.debug.setSnakeSteering(s, false));
    key("ArrowLeft");
    await engine.advance(1);
    expect(snap()).toMatchObject({ dir: "down", turns: [] });
  });
  it("holds a posed next spawn when respawn is disabled", async () => {
    await start();
    engine.apply((s) => engine.debug.setPellet(s, 16, 8));
    engine.apply((s) => engine.debug.setNextPellet(s, 17, 8));
    engine.apply((s) => engine.debug.setPelletRespawn(s, false));
    await engine.advance(1);
    expect(snap()).toMatchObject({
      score: 10,
      pellet: null,
      screen: "playing",
      nextPellet: { col: 17, row: 8 },
    });
  });
  it("clears the board when no spawn is available", async () => {
    await start();
    const cells: C.Cell[] = [];
    for (let row = 1; row <= 16; row++)
      for (let i = 0; i < 28; i++)
        cells.push({ col: row % 2 ? 28 - i : 1 + i, row });
    const free = cells.shift()!;
    engine.apply((s) => engine.debug.setSnake(s, cells));
    engine.apply((s) => engine.debug.setDirection(s, "right"));
    engine.apply((s) => engine.debug.setPellet(s, free.col, free.row));
    await engine.advance(1);
    expect(snap()).toMatchObject({
      screen: "cleared",
      pellet: null,
      score: 10,
    });
    expect(snap().snake).toHaveLength(448);
  });
});
describe("menus and debug surface", () => {
  it("remembers the title selection after how-to", async () => {
    key("ArrowUp");
    await engine.advance(1);
    key("Space");
    await engine.advance(1);
    expect(snap()).toMatchObject({
      screen: "howto",
      titleIndex: 1,
      menuIndex: 0,
    });
    key("Escape");
    await engine.advance(1);
    expect(snap()).toMatchObject({ screen: "title", menuIndex: 1 });
  });
  it("freezes the round and bite during pause, then resumes", async () => {
    await start();
    engine.apply((s) => engine.debug.setPellet(s, 16, 8));
    await engine.advance(1);
    key("KeyP");
    await engine.advance(1);
    const frozen = snap();
    const bite = engine.state.bite;
    await engine.advance(10);
    expect(snap()).toEqual(frozen);
    expect(engine.state.bite).toBe(bite);
    key("Escape");
    await engine.advance(1);
    expect(snap().screen).toBe("playing");
    await engine.advance(1);
    expect(snap().ticks).toBe(frozen.ticks + 1);
  });
  it("restarts while preserving best and returns to the title", async () => {
    await start();
    engine.apply((s) => engine.debug.setScore(s, 120));
    key("KeyP");
    await engine.advance(1);
    key("ArrowDown");
    await engine.advance(1);
    key("Enter");
    await engine.advance(1);
    expect(snap()).toMatchObject({
      screen: "playing",
      score: 0,
      best: 120,
      snake: C.START_CELLS,
    });
    key("Escape");
    await engine.advance(1);
    key("ArrowUp");
    await engine.advance(1);
    key("Enter");
    await engine.advance(1);
    expect(snap().screen).toBe("title");
  });
  it("confirms a click or touch only when both edges hit the same item", async () => {
    const r = engine.debug.menuItemRect(engine.state, 1)!;
    pointer("down", r.x + 10, r.y + 10);
    pointer("up", r.x + 10, r.y + 10);
    await engine.advance(1);
    expect(snap().screen).toBe("howto");
    key("Escape");
    await engine.advance(1);
    const first = engine.debug.menuItemRect(engine.state, 0)!;
    pointer("down", first.x + 10, first.y + 10);
    pointer("up", r.x + 10, r.y + 10);
    await engine.advance(1);
    expect(snap().screen).toBe("title");
    pointer("down", first.x + 10, first.y + 10, 2, "touch");
    await engine.advance(1);
    pointer("up", first.x + 10, first.y + 10, 2, "touch");
    await engine.advance(1);
    expect(snap().screen).toBe("playing");
  });
  it("mirrors mute, resets all session values except mute, and reconciles without advancing", async () => {
    key("KeyM");
    await engine.advance(1);
    expect(snap().muted).toBe(true);
    await start();
    engine.apply((s) => engine.debug.setScore(s, 200));
    engine.apply((s) => engine.debug.setCombo(s, 4));
    const old = snap();
    engine.apply((s) => engine.debug.reconcile(s));
    expect(snap()).toEqual(old);
    engine.apply((s) => engine.debug.reset(s));
    expect(snap()).toMatchObject({
      muted: true,
      screen: "title",
      score: 0,
      best: 0,
      combo: 1,
      ticks: 0,
      simTime: 0,
      pellet: null,
      nextPellet: null,
      steering: true,
      travel: true,
      pelletRespawn: true,
    });
  });
  it("rejects invalid poses loudly and copies external chains", () => {
    expect(() => engine.debug.setScore(engine.state, -1)).toThrow();
    expect(() => engine.debug.setBest(engine.state, 0.1)).toThrow();
    expect(() => engine.debug.setCombo(engine.state, 6)).toThrow();
    expect(() => engine.debug.setComboWindow(engine.state, 4)).toThrow();
    expect(() => engine.debug.setSnake(engine.state, [])).toThrow();
    expect(() =>
      engine.debug.setSnake(engine.state, [
        { col: 1, row: 1 },
        { col: 3, row: 1 },
      ]),
    ).toThrow();
    expect(() => engine.debug.setPellet(engine.state, 15, 8)).toThrow();
    expect(() => engine.debug.setNextPellet(engine.state, 30, 4)).toThrow();
    expect(() => engine.debug.setMenuIndex(engine.state, 2)).toThrow();
    const cells = [{ col: 5, row: 5 }];
    engine.apply((s) => engine.debug.setSnake(s, cells));
    cells[0].col = 8;
    expect(snap().snake[0].col).toBe(5);
    expect(engine.debug.menuItemRect(engine.state, 999)).toBeNull();
  });
  it("draws only valid cells and never consumes the next spawn pose", () => {
    engine.apply((s) => engine.debug.setNextPellet(s, 0, 0));
    const original = snap();
    for (let i = 0; i < 100; i++) {
      const c = engine.debug.drawPelletCell(engine.state)!;
      expect(c.col).toBeGreaterThan(0);
      expect(c.col).toBeLessThan(29);
      expect(c.row).toBeGreaterThan(0);
      expect(c.row).toBeLessThan(17);
      expect(snap().snake).not.toContainEqual(c);
    }
    expect(snap()).toEqual(original);
  });
  it("raises best on the next update rather than during a pose", async () => {
    engine.apply((s) => engine.debug.setScore(s, 300));
    expect(snap().best).toBe(0);
    await engine.advance(1);
    expect(snap().best).toBe(300);
    engine.apply((s) => engine.debug.setBest(s, 20));
    await engine.advance(1);
    expect(snap().best).toBe(300);
  });
});
