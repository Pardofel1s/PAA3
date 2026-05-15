import { useState, useEffect, useRef, useReducer } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CELL = 30;
const COLS = 24;
const ROWS = 24;
const GHOST_DELAY = 300;     // ms between ghost moves
const POWER_DURATION = 8000; // ms

type GameState = "start" | "playing" | "paused" | "gameover";
type Dir = [number, number];

// ─── Maze Generator (Recursive Backtracking, ported from Python) ──────────────
function generateMaze(rows: number, cols: number): number[][] {
  // 1 = wall, 0 = pellet path, 2 = empty (no pellet), 3 = power pellet
  const maze: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(1)
  );

  function carve(x: number, y: number) {
    const dirs: Dir[] = [[0, -2], [0, 2], [-2, 0], [2, 0]];
    // shuffle
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 1 && nx < cols - 1 && ny >= 1 && ny < rows - 1 && maze[ny][nx] === 1) {
        maze[ny][nx] = 0;
        maze[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  maze[1][1] = 0;
  carve(1, 1);

  // Open areas (like Python version)
  for (let i = 0; i < 80; i++) {
    const rx = Math.floor(Math.random() * (cols - 4)) + 2;
    const ry = Math.floor(Math.random() * (rows - 4)) + 2;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = rx + dx;
        const ny = ry + dy;
        if (nx >= 1 && nx < cols - 1 && ny >= 1 && ny < rows - 1) {
          maze[ny][nx] = 0;
        }
      }
    }
  }

  // Ensure borders are walls
  for (let c = 0; c < cols; c++) { maze[0][c] = 1; maze[rows - 1][c] = 1; }
  for (let r = 0; r < rows; r++) { maze[r][0] = 1; maze[r][cols - 1] = 1; }

  // Place power pellets at 4 corners (first open cell near each corner)
  const corners: [number, number][] = [[1, 1], [cols - 2, 1], [1, rows - 2], [cols - 2, rows - 2]];
  for (const [cx, cy] of corners) {
    if (maze[cy][cx] === 0) maze[cy][cx] = 3;
  }

  return maze;
}

// ─── Initial pellets from maze ────────────────────────────────────────────────
function getPellets(maze: number[][]): Set<string> {
  const s = new Set<string>();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (maze[r][c] === 0 || maze[r][c] === 3) s.add(`${c},${r}`);
  return s;
}

// ─── BFS pathfinding (ported from Python) ────────────────────────────────────
function bfs(
  start: [number, number],
  target: [number, number],
  maze: number[][]
): [number, number][] {
  const queue: [number, number][][] = [[start]];
  const visited = new Set<string>();
  visited.add(`${start[0]},${start[1]}`);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const [cx, cy] = path[path.length - 1];

    if (cx === target[0] && cy === target[1]) return path;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (
        nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS &&
        maze[ny][nx] !== 1 &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push([...path, [nx, ny]]);
      }
    }
  }
  return [];
}

// ─── Ghost definitions ────────────────────────────────────────────────────────
interface GhostData {
  name: string;
  color: string;
  pos: [number, number];
  mode: "CHASE" | "SCATTER" | "PATROL" | "CAGED" | "FLED";
  scatterTarget: [number, number];
}

function initGhosts(): GhostData[] {
  return [
    { name: "BLINKY", color: "#ff2e4d", pos: [COLS - 3, ROWS - 3], mode: "CHASE",   scatterTarget: [COLS - 1, 0] },
    { name: "PINKY",  color: "#ffb8ff", pos: [COLS - 5, ROWS - 5], mode: "SCATTER", scatterTarget: [0, 0] },
    { name: "INKY",   color: "#22e3ff", pos: [COLS - 3, ROWS - 5], mode: "PATROL",  scatterTarget: [COLS - 1, ROWS - 1] },
    { name: "CLYDE",  color: "#ffa940", pos: [COLS - 5, ROWS - 3], mode: "CAGED",   scatterTarget: [0, ROWS - 1] },
  ];
}

function findSafeGhostStart(maze: number[][], preferred: [number, number]): [number, number] {
  const [px, py] = preferred;
  if (maze[py][px] !== 1) return preferred;
  // search outward
  for (let d = 1; d < 5; d++) {
    for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = px + dx * d;
      const ny = py + dy * d;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && maze[ny][nx] !== 1)
        return [nx, ny];
    }
  }
  return [COLS - 3, ROWS - 3];
}

// ─── Game State ───────────────────────────────────────────────────────────────
interface State {
  maze: number[][];
  player: [number, number];
  ghosts: GhostData[];
  pellets: Set<string>;
  score: number;
  highScore: number;
  lives: number;
  gameState: GameState;
  powerMode: boolean;
  powerEnd: number;
  playerDir: Dir;
  level: number;
}

type Action =
  | { type: "START_GAME" }
  | { type: "RESTART_GAME" }
  | { type: "PAUSE_TOGGLE" }
  | { type: "MOVE_PLAYER"; dir: Dir }
  | { type: "TICK_GHOSTS"; now: number };

function makeInitialState(prev?: State): State {
  const maze = generateMaze(ROWS, COLS);
  const ghosts = initGhosts().map(g => ({
    ...g,
    pos: findSafeGhostStart(maze, g.pos)
  }));
  return {
    maze,
    player: [1, 1],
    ghosts,
    pellets: getPellets(maze),
    score: prev?.score ?? 0,
    highScore: prev?.highScore ?? 0,
    lives: 3,
    gameState: "start",
    powerMode: false,
    powerEnd: 0,
    playerDir: [1, 0],
    level: 1,
  };
}

function moveGhostStep(ghost: GhostData, player: [number, number], maze: number[][], powerMode: boolean): GhostData {
  if (ghost.mode === "CAGED") return ghost;

  let target: [number, number];

  if (powerMode) {
    // flee: go to scatter corner
    target = ghost.scatterTarget;
  } else if (ghost.mode === "CHASE") {
    target = player;
  } else if (ghost.mode === "SCATTER") {
    // Pinky ambushes 4 ahead
    target = player;
  } else {
    // PATROL - wander near player
    target = player;
  }

  const path = bfs(ghost.pos, target, maze);
  if (path.length > 1) {
    return { ...ghost, pos: path[1] };
  }
  return ghost;
}

function gameReducer(state: State, action: Action): State {
  switch (action.type) {

    case "START_GAME": {
      const maze = generateMaze(ROWS, COLS);
      const ghosts = initGhosts().map(g => ({ ...g, pos: findSafeGhostStart(maze, g.pos) }));
      return {
        ...state,
        maze,
        player: [1, 1],
        ghosts,
        pellets: getPellets(maze),
        lives: 3,
        score: 0,
        gameState: "playing",
        powerMode: false,
        powerEnd: 0,
            playerDir: [1, 0],
        level: 1,
      };
    }

    case "RESTART_GAME": {
      const maze = generateMaze(ROWS, COLS);
      const ghosts = initGhosts().map(g => ({ ...g, pos: findSafeGhostStart(maze, g.pos) }));
      return {
        ...state,
        maze,
        player: [1, 1],
        ghosts,
        pellets: getPellets(maze),
        lives: 3,
        score: 0,
        gameState: "start",
        powerMode: false,
        powerEnd: 0,
            playerDir: [1, 0],
        level: 1,
      };
    }

    case "PAUSE_TOGGLE": {
      if (state.gameState === "playing") return { ...state, gameState: "paused" };
      if (state.gameState === "paused") return { ...state, gameState: "playing" };
      return state;
    }

case "MOVE_PLAYER": {
      if (state.gameState !== "playing") return state;
      const [dx, dy] = action.dir;
      const nx = state.player[0] + dx;
      const ny = state.player[1] + dy;

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || state.maze[ny][nx] === 1) {
        return state;
      }

      const newPlayer: [number, number] = [nx, ny];
      const key = `${nx},${ny}`;
      let newScore = state.score;
      let newPellets = state.pellets;
      let powerMode = state.powerMode;
      let powerEnd = state.powerEnd;

      const cell = state.maze[ny][nx];

      if (newPellets.has(key)) {
        newPellets = new Set(newPellets);
        newPellets.delete(key);
        if (cell === 3) {
          // power pellet
          newScore += 50;
          powerMode = true;
          powerEnd = Date.now() + POWER_DURATION;
        } else {
          newScore += 10;
        }
      }

      // Check ghost collision after move
      let newGhosts = state.ghosts;
      let newLives = state.lives;
      let newGameState: GameState = state.gameState;
      let resetPlayer: [number, number] = newPlayer;

      for (let i = 0; i < newGhosts.length; i++) {
        const g = newGhosts[i];
        if (g.pos[0] === newPlayer[0] && g.pos[1] === newPlayer[1] && g.mode !== "CAGED") {
          if (powerMode) {
            // eat ghost
            newScore += 200;
            newGhosts = newGhosts.map((gh, idx) =>
              idx === i ? { ...gh, pos: findSafeGhostStart(state.maze, initGhosts()[idx].pos), mode: "CAGED" as const } : gh
            );
          } else {
            newLives -= 1;
            if (newLives <= 0) {
              newGameState = "gameover";
            } else {
              // reset positions
              resetPlayer = [1, 1];
              newGhosts = state.ghosts.map((g, idx) => ({
                ...g,
                pos: findSafeGhostStart(state.maze, initGhosts()[idx].pos)
              }));
            }
          }
        }
      }

      const newHighScore = Math.max(state.highScore, newScore);

      return {
        ...state,
        player: newGameState === "gameover" ? state.player : resetPlayer,
        ghosts: newGhosts,
        pellets: newPellets,
        score: newScore,
        highScore: newHighScore,
        lives: newLives,
        gameState: newGameState,
        powerMode,
        powerEnd,
        playerDir: action.dir,
      };
    }

    case "TICK_GHOSTS": {
      if (state.gameState !== "playing") return state;

      const now = action.now;
      const stillPower = state.powerMode && now < state.powerEnd;

      // Release Clyde after score threshold
      let ghosts = state.ghosts.map(g => {
        if (g.mode === "CAGED" && g.name === "CLYDE" && state.score >= 100) {
          return { ...g, mode: "CHASE" as const };
        }
        return g;
      });

      // Move each non-caged ghost
      ghosts = ghosts.map(g => moveGhostStep(g, state.player, state.maze, stillPower));

      // Check ghost-player collision after ghost moves
      let newLives = state.lives;
      let newGameState: GameState = state.gameState;
      let newScore = state.score;
      let resetPlayer: [number, number] = state.player;

      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        if (g.pos[0] === state.player[0] && g.pos[1] === state.player[1] && g.mode !== "CAGED") {
          if (stillPower) {
            newScore += 200;
            ghosts = ghosts.map((gh, idx) =>
              idx === i ? { ...gh, pos: findSafeGhostStart(state.maze, initGhosts()[idx].pos), mode: "CAGED" as const } : gh
            );
          } else {
            newLives -= 1;
            if (newLives <= 0) {
              newGameState = "gameover";
            } else {
              resetPlayer = [1, 1];
              ghosts = state.ghosts.map((gh, idx) => ({
                ...gh,
                pos: findSafeGhostStart(state.maze, initGhosts()[idx].pos)
              }));
            }
          }
        }
      }

      const newHighScore = Math.max(state.highScore, newScore);

      return {
        ...state,
        ghosts,
        player: newGameState === "gameover" ? state.player : resetPlayer,
        lives: newLives,
        score: newScore,
        highScore: newHighScore,
        gameState: newGameState,
        powerMode: stillPower,
      };
    }

    default:
      return state;
  }
}

// ─── SVG Components ───────────────────────────────────────────────────────────
function Ghost({ x, y, color, eyeDir = "right", fled = false }: {
  x: number; y: number; color: string; eyeDir?: "right" | "left"; fled?: boolean;
}) {
  const pupil = eyeDir === "right" ? 3 : -3;
  const bodyColor = fled ? "#2244cc" : color;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d={`M 2 14 A 12 12 0 0 1 26 14 L 26 25 L 23 22 L 20 25 L 17 22 L 14 25 L 11 22 L 8 25 L 5 22 L 2 25 Z`}
        fill={bodyColor}
      />
      {!fled ? (
        <>
          <circle cx="10" cy="12" r="4" fill="white" />
          <circle cx="19" cy="12" r="4" fill="white" />
          <circle cx={10 + pupil} cy="12" r="2" fill="#0a1f6b" />
          <circle cx={19 + pupil} cy="12" r="2" fill="#0a1f6b" />
        </>
      ) : (
        <>
          <circle cx="10" cy="12" r="3" fill="white" opacity="0.7" />
          <circle cx="19" cy="12" r="3" fill="white" opacity="0.7" />
          <path d="M 7 16 Q 10 13 13 16 Q 16 13 19 16 Q 22 13 22 16" stroke="white" strokeWidth="1.5" fill="none" opacity="0.7" />
        </>
      )}
    </g>
  );
}

function PacMan({ x, y, size = 26, mouth = 0.35, dir = 0 }: {
  x: number; y: number; size?: number; mouth?: number; dir?: number;
}) {
  const r = size / 2;
  const a = Math.PI * mouth;
  const cx = x + r;
  const cy = y + r;
  const x1 = cx + r * Math.cos(a);
  const y1 = cy + r * Math.sin(a);
  const x2 = cx + r * Math.cos(-a);
  const y2 = cy + r * Math.sin(-a);
  return (
    <g transform={`rotate(${dir} ${cx} ${cy})`}>
      <path
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 1 0 ${x2} ${y2} Z`}
        fill="#FFD23F"
      />
    </g>
  );
}

// ─── Maze Renderer ────────────────────────────────────────────────────────────
function MazeView({ state }: { state: State }) {
  const W = CELL * COLS;
  const H = CELL * ROWS;
  const { maze, player, ghosts, pellets, playerDir, powerMode } = state;

  // Calculate pac-man rotation from dir
  const [dx, dy] = playerDir;
  let pacDir = 0;
  if (dx === 1) pacDir = 0;
  else if (dx === -1) pacDir = 180;
  else if (dy === -1) pacDir = 270;
  else if (dy === 1) pacDir = 90;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="absolute inset-0 w-full h-full"
      style={{ filter: "drop-shadow(0 0 8px rgba(0, 229, 255, 0.35))" }}
    >
      <defs>
        <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Walls */}
      <g filter="url(#neon)" stroke="#00e5ff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {maze.map((row, r) =>
          row.map((c, k) => {
            if (c !== 1) return null;
            const x = k * CELL;
            const y = r * CELL;
            const top   = maze[r - 1]?.[k] === 1;
            const bot   = maze[r + 1]?.[k] === 1;
            const left  = maze[r]?.[k - 1] === 1;
            const right = maze[r]?.[k + 1] === 1;
            const ins = 6;
            return (
              <g key={`w-${r}-${k}`}>
                {top   && <line x1={x+CELL/2} y1={y-1}      x2={x+CELL/2}   y2={y+ins} />}
                {bot   && <line x1={x+CELL/2} y1={y+CELL-ins} x2={x+CELL/2}  y2={y+CELL+1} />}
                {left  && <line x1={x-1}      y1={y+CELL/2} x2={x+ins}       y2={y+CELL/2} />}
                {right && <line x1={x+CELL-ins} y1={y+CELL/2} x2={x+CELL+1} y2={y+CELL/2} />}
                {top && right && <path d={`M ${x+CELL/2} ${y+ins} Q ${x+CELL/2} ${y+CELL/2} ${x+CELL-ins} ${y+CELL/2}`} />}
                {top && left  && <path d={`M ${x+CELL/2} ${y+ins} Q ${x+CELL/2} ${y+CELL/2} ${x+ins} ${y+CELL/2}`} />}
                {bot && right && <path d={`M ${x+CELL-ins} ${y+CELL/2} Q ${x+CELL/2} ${y+CELL/2} ${x+CELL/2} ${y+CELL-ins}`} />}
                {bot && left  && <path d={`M ${x+ins} ${y+CELL/2} Q ${x+CELL/2} ${y+CELL/2} ${x+CELL/2} ${y+CELL-ins}`} />}
              </g>
            );
          })
        )}
      </g>

      {/* Pellets */}
      <g>
        {Array.from(pellets).map(key => {
          const [kx, ky] = key.split(",").map(Number);
          const cell = maze[ky][kx];
          if (cell === 3) {
            return (
              <circle key={key} cx={kx*CELL+CELL/2} cy={ky*CELL+CELL/2} r="6" fill="#ffffff"
                style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))" }}>
                <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />
              </circle>
            );
          }
          return (
            <circle key={key} cx={kx*CELL+CELL/2} cy={ky*CELL+CELL/2} r="2.2" fill="#fff5d6" />
          );
        })}
      </g>

      {/* Pac-Man */}
      <g style={{ filter: "drop-shadow(0 0 10px rgba(255,210,63,0.6))" }}>
        <PacMan
          x={player[0] * CELL + 2}
          y={player[1] * CELL + 2}
          size={CELL - 4}
          mouth={0.32}
          dir={pacDir}
        />
      </g>

      {/* Ghosts */}
      {ghosts.map((g) => {
        if (g.mode === "CAGED") return null;
        const gx = g.pos[0] * CELL + 1;
        const gy = g.pos[1] * CELL + 1;
        return (
          <g key={g.name} style={{ filter: `drop-shadow(0 0 8px ${g.color}88)` }}
            opacity={powerMode && g.mode !== "CAGED" ? undefined : 0.95}>
            {powerMode && g.mode !== "CAGED" ? (
              <g opacity={0.85}>
                <animate attributeName="opacity" values="0.85;0.4;0.85" dur="0.6s" repeatCount="indefinite" />
                <Ghost x={gx} y={gy} color={g.color} eyeDir="right" fled />
              </g>
            ) : (
              <Ghost x={gx} y={gy} color={g.color} eyeDir={g.pos[0] < player[0] ? "right" : "left"} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Overlays ─────────────────────────────────────────────────────────────────
function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm">
      <div className="text-center px-8">
        <div className="text-[#FFD23F] tracking-[0.3em] mb-2"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px" }}>
          PROCEDURAL
        </div>
        <h1 className="text-[#FFD23F] mb-10"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "44px", lineHeight: 1.1,
            textShadow: "0 0 18px rgba(255,210,63,0.7), 0 0 36px rgba(255,210,63,0.3)" }}>
          PAC-MAN
        </h1>
        <div className="flex justify-center gap-3 mb-12">
          <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse [animation-delay:300ms]" />
        </div>
        <button onClick={onStart}
          className="group relative px-10 py-4 border-2 border-[#FFD23F] text-[#FFD23F] hover:bg-[#FFD23F] hover:text-black transition-all duration-200"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "16px",
            boxShadow: "0 0 24px rgba(255,210,63,0.35), inset 0 0 24px rgba(255,210,63,0.08)" }}>
          START GAME
        </button>
        <div className="mt-12 text-[#7a8299]"
          style={{ fontFamily: "'VT323', monospace", fontSize: "22px", letterSpacing: "0.08em" }}>
          USE ARROW KEYS TO MOVE
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {["↑", "←", "↓", "→"].map(k => (
            <kbd key={k} className="inline-flex items-center justify-center w-9 h-9 border border-[#00e5ff]/40 text-[#00e5ff]"
              style={{ fontFamily: "'VT323', monospace", fontSize: "20px" }}>{k}</kbd>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameOverOverlay({ score, onRestart }: { score: number; onRestart: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/82 backdrop-blur-sm">
      <div className="text-center px-8">
        <h1 className="text-[#ff2e4d] mb-6"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "52px", lineHeight: 1.05,
            textShadow: "0 0 22px rgba(255,46,77,0.8), 0 0 44px rgba(255,46,77,0.4)" }}>
          GAME<br />OVER
        </h1>
        <div className="w-44 h-px bg-gradient-to-r from-transparent via-[#ff2e4d]/60 to-transparent mx-auto mb-8" />
        <div className="text-[#7a8299] mb-1 tracking-[0.4em]"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
          FINAL SCORE
        </div>
        <div className="text-white mb-10"
          style={{ fontFamily: "'VT323', monospace", fontSize: "64px", lineHeight: 1,
            textShadow: "0 0 16px rgba(255,255,255,0.5)" }}>
          {String(score).padStart(5, "0")}
        </div>
        <button onClick={onRestart}
          className="px-10 py-4 border-2 border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black transition-all duration-200"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "16px",
            boxShadow: "0 0 24px rgba(0,229,255,0.4), inset 0 0 24px rgba(0,229,255,0.08)" }}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}

function PausedOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/72 backdrop-blur-sm">
      <div className="text-center">
        <h1 className="text-[#00e5ff] mb-8"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "40px",
            textShadow: "0 0 22px rgba(0,229,255,0.8)" }}>
          PAUSED
        </h1>
        <button onClick={onResume}
          className="px-10 py-4 border-2 border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff] hover:text-black transition-all duration-200"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px" }}>
          RESUME
        </button>
        <div className="mt-6 text-[#7a8299]"
          style={{ fontFamily: "'VT323', monospace", fontSize: "18px" }}>
          PRESS SPACE TO RESUME
        </div>
      </div>
    </div>
  );
}

function StateChip({ active, label, onClick, color }: { active: boolean; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="px-4 py-2 border transition-all"
      style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", letterSpacing: "0.1em",
        borderColor: active ? color : "rgba(122,130,153,0.3)",
        color: active ? color : "#7a8299",
        boxShadow: active ? `0 0 14px ${color}44, inset 0 0 14px ${color}11` : "none",
        background: active ? `${color}10` : "transparent" }}>
      {label}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, makeInitialState);

  const ghostMoveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track gameState in a ref so the keydown handler always sees the latest value
  const gameStateRef = useRef(state.gameState);
  useEffect(() => { gameStateRef.current = state.gameState; }, [state.gameState]);

  // ── Keyboard input — one keydown = one step, no repeat while held ──────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore browser key-repeat events (held key fires multiple events)
      if (e.repeat) return;

      let dir: Dir | null = null;
      switch (e.key) {
        case "ArrowUp":    case "w": case "W": dir = [0, -1]; e.preventDefault(); break;
        case "ArrowDown":  case "s": case "S": dir = [0,  1]; e.preventDefault(); break;
        case "ArrowLeft":  case "a": case "A": dir = [-1, 0]; e.preventDefault(); break;
        case "ArrowRight": case "d": case "D": dir = [1,  0]; e.preventDefault(); break;
        case " ": dispatch({ type: "PAUSE_TOGGLE" }); e.preventDefault(); return;
      }

      if (dir && gameStateRef.current === "playing") {
        dispatch({ type: "MOVE_PLAYER", dir });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Ghost move loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.gameState !== "playing") {
      if (ghostMoveTimer.current) clearInterval(ghostMoveTimer.current);
      return;
    }
    ghostMoveTimer.current = setInterval(() => {
      dispatch({ type: "TICK_GHOSTS", now: Date.now() });
    }, GHOST_DELAY);
    return () => { if (ghostMoveTimer.current) clearInterval(ghostMoveTimer.current); };
  }, [state.gameState]);

  const { score, highScore, lives, gameState, ghosts, pellets, powerMode } = state;

  const pelletCount = pellets.size;
  const totalPellets = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => state.maze[r][c])
  ).flat().filter(c => c === 0 || c === 3).length;

  return (
    <div className="min-h-screen w-full bg-[#05060a] text-white"
      style={{ backgroundImage:
        "radial-gradient(1200px 600px at 50% -10%, rgba(0,229,255,0.08), transparent 60%), radial-gradient(800px 400px at 50% 110%, rgba(255,210,63,0.05), transparent 60%)" }}>

      {/* CRT scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.06] mix-blend-screen"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.7) 0px, rgba(255,255,255,0.7) 1px, transparent 1px, transparent 3px)" }} />

      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-8">

        {/* Top bar */}
        <header className="flex items-center justify-between mb-8 pb-5 border-b border-[#00e5ff]/15">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7">
              <svg viewBox="0 0 32 32" className="w-full h-full">
                <PacMan x={3} y={3} size={26} mouth={0.32} />
              </svg>
            </div>
            <div>
              <div className="text-[#FFD23F] tracking-[0.25em]"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "11px" }}>
                PAC-MAN
              </div>
              <div className="text-[#7a8299] tracking-[0.18em] mt-0.5"
                style={{ fontFamily: "'VT323', monospace", fontSize: "14px" }}>
                PROCEDURAL.MAZE.v1.0
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${gameState === "playing" ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
              <span className={`tracking-[0.18em] ${gameState === "playing" ? "text-emerald-400" : "text-gray-600"}`}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                {gameState === "playing" ? "LIVE" : gameState.toUpperCase()}
              </span>
            </div>
            <div className="text-[#7a8299] tracking-[0.18em]"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
              LEVEL {state.level.toString().padStart(2, "0")} / 12
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StateChip label="PLAYING"   active={gameState === "playing"}  onClick={() => { if (gameState === "start") dispatch({ type: "START_GAME" }); }} color="#00e5ff" />
            <StateChip label="START"     active={gameState === "start"}    onClick={() => dispatch({ type: "RESTART_GAME" })} color="#FFD23F" />
            <StateChip label="GAME OVER" active={gameState === "gameover"} onClick={() => {}} color="#ff2e4d" />
          </div>
        </header>

        {/* Main grid */}
        <main className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 lg:gap-8 items-start">

          {/* Game viewport */}
          <section className="relative">
            <div className="relative mx-auto aspect-square w-full max-w-[720px] bg-black border-2 border-[#00e5ff]/50 overflow-hidden"
              style={{ boxShadow: "0 0 0 1px rgba(0,229,255,0.15), 0 0 40px rgba(0,229,255,0.25), inset 0 0 80px rgba(0,229,255,0.05)" }}>

              <MazeView state={state} />

              {gameState === "start"    && <StartOverlay   onStart={()   => dispatch({ type: "START_GAME" })} />}
              {gameState === "gameover" && <GameOverOverlay score={score} onRestart={() => dispatch({ type: "RESTART_GAME" })} />}
              {gameState === "paused"   && <PausedOverlay  onResume={()  => dispatch({ type: "PAUSE_TOGGLE" })} />}

              {/* Power mode indicator */}
              {powerMode && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 border border-white/60 text-white"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px",
                    boxShadow: "0 0 12px rgba(255,255,255,0.5)", background: "rgba(0,0,0,0.7)" }}>
                  ⚡ POWER MODE
                </div>
              )}

              {/* Corner brackets */}
              {["top-2 left-2 border-l-2 border-t-2","top-2 right-2 border-r-2 border-t-2",
                "bottom-2 left-2 border-l-2 border-b-2","bottom-2 right-2 border-r-2 border-b-2"].map((c, i) => (
                <div key={i} className={`absolute ${c} border-[#FFD23F]/60 w-4 h-4 pointer-events-none`} />
              ))}
            </div>

            {/* Viewport footer */}
            <div className="mt-4 flex items-center justify-between px-1">
              <div className="text-[#7a8299] tracking-[0.2em]"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
                720 × 720 · 24 × 24 GRID
              </div>
              <div className={`tracking-[0.2em] ${gameState === "playing" ? "text-[#00e5ff]" : "text-[#7a8299]"}`}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
                {gameState === "playing" ? "● RENDERING" : gameState === "paused" ? "⏸ PAUSED" : gameState === "start" ? "○ IDLE" : "× HALTED"}
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">

            {/* Score */}
            <div className="border border-[#00e5ff]/25 bg-[#0a0d18] p-5">
              <div className="text-[#00e5ff] tracking-[0.32em] mb-3"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>
                SCORE
              </div>
              <div className="text-[#FFD23F]"
                style={{ fontFamily: "'VT323', monospace", fontSize: "56px", lineHeight: 1,
                  letterSpacing: "0.04em", textShadow: "0 0 12px rgba(255,210,63,0.55)" }}>
                {String(score).padStart(5, "0")}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[#7a8299] tracking-[0.18em]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>HIGH</span>
                <span className="text-white/80"
                  style={{ fontFamily: "'VT323', monospace", fontSize: "20px", letterSpacing: "0.04em" }}>
                  {String(highScore).padStart(5, "0")}
                </span>
              </div>
            </div>

            {/* Lives */}
            <div className="border border-[#00e5ff]/25 bg-[#0a0d18] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[#00e5ff] tracking-[0.32em]"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>LIVES</div>
                <div className="text-[#7a8299]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>×{lives}</div>
              </div>
              <div className="flex items-center gap-3 h-10">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="transition-opacity"
                    style={{ opacity: i < lives ? 1 : 0.18, filter: "drop-shadow(0 0 6px rgba(255,210,63,0.5))" }}>
                    <svg width="26" height="26" viewBox="0 0 32 32">
                      <PacMan x={3} y={3} size={26} mouth={0.3} />
                    </svg>
                  </div>
                ))}
              </div>
            </div>

            {/* Ghosts roster */}
            <div className="border border-[#00e5ff]/25 bg-[#0a0d18] p-5">
              <div className="text-[#00e5ff] tracking-[0.32em] mb-3"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>GHOSTS</div>
              <div className="space-y-2.5">
                {ghosts.map(g => (
                  <div key={g.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <svg width="20" height="20" viewBox="0 0 28 28">
                        <Ghost x={1} y={1} color={g.color} eyeDir="right" fled={powerMode && g.mode !== "CAGED"} />
                      </svg>
                      <span className="text-white/90 tracking-[0.18em]"
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                        {g.name}
                      </span>
                    </div>
                    <span className="tracking-[0.18em]"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
                        color: g.mode === "CAGED" ? "#7a8299" : powerMode ? "#ffffff" : g.color,
                        opacity: g.mode === "CAGED" ? 0.6 : 0.9 }}>
                      {powerMode && g.mode !== "CAGED" ? "FLED" : g.mode}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="border border-[#00e5ff]/25 bg-[#0a0d18] p-5">
              <div className="text-[#00e5ff] tracking-[0.32em] mb-3"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>CONTROLS</div>
              <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto mb-3">
                <div />
                <kbd className="inline-flex items-center justify-center w-9 h-9 border border-[#00e5ff]/40 text-[#00e5ff]"
                  style={{ fontFamily: "'VT323', monospace", fontSize: "20px" }}>↑</kbd>
                <div />
                <kbd className="inline-flex items-center justify-center w-9 h-9 border border-[#00e5ff]/40 text-[#00e5ff]"
                  style={{ fontFamily: "'VT323', monospace", fontSize: "20px" }}>←</kbd>
                <kbd className="inline-flex items-center justify-center w-9 h-9 border border-[#00e5ff]/40 text-[#00e5ff]"
                  style={{ fontFamily: "'VT323', monospace", fontSize: "20px" }}>↓</kbd>
                <kbd className="inline-flex items-center justify-center w-9 h-9 border border-[#00e5ff]/40 text-[#00e5ff]"
                  style={{ fontFamily: "'VT323', monospace", fontSize: "20px" }}>→</kbd>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#00e5ff]/15">
                <span className="text-[#7a8299] tracking-[0.18em]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>PAUSE</span>
                <kbd className="px-2 py-1 border border-[#00e5ff]/40 text-[#00e5ff]"
                  style={{ fontFamily: "'VT323', monospace", fontSize: "14px" }}>SPACE</kbd>
              </div>
            </div>

          </aside>
        </main>

        {/* Footer */}
        <footer className="mt-10 pt-5 border-t border-[#00e5ff]/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-[#7a8299] tracking-[0.22em]"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
            © 2026 · NEON ARCADE LABS · BUILD 1.0.0
          </div>
          <div className="flex items-center gap-5">
            {[
              `PELLETS ${pelletCount} / ${totalPellets}`,
              `POWER × ${Array.from(pellets).filter(k => { const [x,y]=k.split(",").map(Number); return state.maze[y][x]===3; }).length}`,
              `GHOSTS ACTIVE ${ghosts.filter(g => g.mode !== "CAGED").length}`,
            ].map(t => (
              <span key={t} className="text-[#7a8299] tracking-[0.22em]"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
                {t}
              </span>
            ))}
          </div>
        </footer>

      </div>
    </div>
  );
}
