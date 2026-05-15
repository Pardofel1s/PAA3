import pygame
import random
from collections import deque

# =========================
# INIT
# =========================
pygame.init()

WIDTH, HEIGHT = 720, 720
TILE = 24

ROWS = HEIGHT // TILE
COLS = WIDTH // TILE

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Pac-Man Procedural BFS")

clock = pygame.time.Clock()
font = pygame.font.SysFont("Arial", 24)

# =========================
# COLORS
# =========================
BLACK = (0, 0, 0)
BLUE = (40, 40, 255)
YELLOW = (255, 255, 0)
WHITE = (255, 255, 255)
RED = (255, 70, 70)

# =========================
# MAZE GENERATOR
# Recursive Backtracking
# =========================
def generate_maze(rows, cols):

    maze = [['#' for _ in range(cols)] for _ in range(rows)]

    def carve(x, y):

        directions = [
            (0, -2),
            (0, 2),
            (-2, 0),
            (2, 0)
        ]

        random.shuffle(directions)

        for dx, dy in directions:

            nx = x + dx
            ny = y + dy

            if 1 <= nx < cols - 1 and 1 <= ny < rows - 1:

                if maze[ny][nx] == '#':

                    maze[ny][nx] = '.'
                    maze[y + dy // 2][x + dx // 2] = '.'

                    carve(nx, ny)

    maze[1][1] = '.'
    carve(1, 1)

    # Tambah beberapa open area
    for _ in range(80):

        rx = random.randint(2, cols - 3)
        ry = random.randint(2, rows - 3)

        for dy in range(-1, 2):
            for dx in range(-1, 2):

                if (
                    1 <= rx + dx < cols - 1
                    and 1 <= ry + dy < rows - 1
                ):
                    maze[ry + dy][rx + dx] = '.'

    return maze

maze = generate_maze(ROWS, COLS)

# =========================
# PLAYER & GHOST
# =========================
player = [1, 1]
ghost = [COLS - 3, ROWS - 3]

if maze[ghost[1]][ghost[0]] == '#':
    ghost = [COLS - 5, ROWS - 5]

score = 0
lives = 3
game_over = False

# =========================
# PELLETS
# =========================
pellets = set()

def spawn_pellet():

    while True:

        x = random.randint(1, COLS - 2)
        y = random.randint(1, ROWS - 2)

        if (
            maze[y][x] != '#'
            and (x, y) != tuple(player)
            and (x, y) != tuple(ghost)
            and (x, y) not in pellets
        ):
            pellets.add((x, y))
            break

# Spawn awal
for _ in range(5):
    spawn_pellet()

# =========================
# DRAW
# =========================
def draw():
    screen.fill(BLACK)

    for y in range(ROWS):
        for x in range(COLS):

            rect = pygame.Rect(
                x * TILE,
                y * TILE,
                TILE,
                TILE
            )

            if maze[y][x] == '#':
                pygame.draw.rect(screen, BLUE, rect)

            if (x, y) in pellets:
                pygame.draw.circle(
                    screen,
                    WHITE,
                    (
                        x * TILE + TILE // 2,
                        y * TILE + TILE // 2
                    ),
                    3
                )

    # Player
    pygame.draw.circle(
        screen,
        YELLOW,
        (
            player[0] * TILE + TILE // 2,
            player[1] * TILE + TILE // 2
        ),
        TILE // 2 - 2
    )

    # Ghost
    pygame.draw.circle(
        screen,
        RED,
        (
            ghost[0] * TILE + TILE // 2,
            ghost[1] * TILE + TILE // 2
        ),
        TILE // 2 - 2
    )

    score_text = font.render(f"Score: {score}", True, WHITE)
    lives_text = font.render(f"Lives: {lives}", True, WHITE)

    screen.blit(score_text, (10, 10))
    screen.blit(lives_text, (10, 40))

    if game_over:
        text = font.render("GAME OVER", True, RED)
        screen.blit(text, (WIDTH // 2 - 90, HEIGHT // 2))

    pygame.display.flip()

# =========================
# BFS PATHFINDING
# =========================
def bfs(start, target):
    queue = deque([[start]])
    visited = set()

    while queue:
        path = queue.popleft()
        current = path[-1]

        if current == target:
            return path

        if current in visited:
            continue

        visited.add(current)

        x, y = current

        neighbors = [
            (x + 1, y),
            (x - 1, y),
            (x, y + 1),
            (x, y - 1),
        ]

        for nx, ny in neighbors:

            if (
                0 <= nx < COLS
                and 0 <= ny < ROWS
                and maze[ny][nx] != '#'
            ):
                queue.append(path + [(nx, ny)])

    return []

# =========================
# MOVE GHOST
# =========================
def move_ghost():

    global ghost

    path = bfs(tuple(ghost), tuple(player))

    if len(path) > 1:
        ghost[0], ghost[1] = path[1]
        
ghost_move_delay = 300
last_ghost_move = 0

# =========================
# RESET
# =========================
def reset_positions():

    player[0], player[1] = 1, 1

    while True:

        gx = random.randint(COLS // 2, COLS - 2)
        gy = random.randint(ROWS // 2, ROWS - 2)

        if maze[gy][gx] != '#':
            ghost[0], ghost[1] = gx, gy
            break

# =========================
# MAIN LOOP
# =========================
running = True

while running:

    clock.tick(10)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    if not game_over:

        keys = pygame.key.get_pressed()

        dx = 0
        dy = 0

        if keys[pygame.K_UP]:
            dy = -1
        elif keys[pygame.K_DOWN]:
            dy = 1
        elif keys[pygame.K_LEFT]:
            dx = -1
        elif keys[pygame.K_RIGHT]:
            dx = 1

        nx = player[0] + dx
        ny = player[1] + dy

        if (
            0 <= nx < COLS
            and 0 <= ny < ROWS
            and maze[ny][nx] != '#'
        ):
            player[0] = nx
            player[1] = ny

        if tuple(player) in pellets:
            pellets.remove(tuple(player))
            score += 10
            spawn_pellet()

        current_time = pygame.time.get_ticks()
        if current_time - last_ghost_move > ghost_move_delay:
            move_ghost()
            last_ghost_move = current_time

        # Collision
        if player == ghost:
            lives -= 1
            reset_positions()

            if lives <= 0:
                game_over = True

    draw()

pygame.quit()