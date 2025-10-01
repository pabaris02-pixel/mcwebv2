const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 32;
const WORLD_WIDTH = 120;
const WORLD_HEIGHT = 60;
const GRAVITY = 0.5;
const FRICTION = 0.8;
const MOVE_SPEED = 0.6;
const MAX_SPEED_X = 5;
const MAX_SPEED_Y = 12;

const BLOCKS = {
  air: { solid: false, color: null },
  grass: { solid: true, color: "#3fa63f" },
  dirt: { solid: true, color: "#8b5a2b" },
  stone: { solid: true, color: "#9ea8b8" },
  wood: { solid: true, color: "#8b5a2b" },
  leaves: { solid: false, color: "#4ca04c" },
};

const INVENTORY = ["grass", "dirt", "stone", "wood", "leaves"];
let selectedIndex = 0;

const world = Array.from({ length: WORLD_WIDTH }, () =>
  Array.from({ length: WORLD_HEIGHT }, () => "air"),
);

function generateWorld() {
  let height = Math.floor(WORLD_HEIGHT * 0.55);
  for (let x = 0; x < WORLD_WIDTH; x++) {
    height += Math.floor(Math.random() * 5 - 2);
    height = Math.max(10, Math.min(WORLD_HEIGHT - 8, height));

    const stoneDepth = Math.floor(Math.random() * 3) + 3;

    for (let y = height; y < WORLD_HEIGHT; y++) {
      const depth = y - height;
      if (depth === 0) {
        world[x][y] = "grass";
      } else if (depth < stoneDepth) {
        world[x][y] = "dirt";
      } else {
        world[x][y] = "stone";
      }
    }
  }

  // Add trees
  for (let x = 5; x < WORLD_WIDTH - 5; x += Math.floor(Math.random() * 9) + 6) {
    const surfaceY = world[x].findIndex((block) => block !== "air");
    if (surfaceY === -1 || surfaceY < 5) continue;

    const treeHeight = Math.floor(Math.random() * 3) + 4;
    for (let y = surfaceY - 1; y > surfaceY - treeHeight; y--) {
      if (y >= 0) world[x][y] = "wood";
    }
    for (let lx = -2; lx <= 2; lx++) {
      for (let ly = -2; ly <= 1; ly++) {
        const nx = x + lx;
        const ny = surfaceY - treeHeight + ly;
        if (
          nx >= 0 &&
          nx < WORLD_WIDTH &&
          ny >= 0 &&
          ny < WORLD_HEIGHT &&
          Math.abs(lx) + Math.abs(ly) < 4
        ) {
          if (world[nx][ny] === "air") {
            world[nx][ny] = "leaves";
          }
        }
      }
    }
  }
}

generateWorld();

const player = {
  x: (WORLD_WIDTH / 2) * TILE,
  y: 20 * TILE,
  vx: 0,
  vy: 0,
  width: 0.6 * TILE,
  height: 1.8 * TILE,
  onGround: false,
};

const keys = new Set();

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Tab"].includes(e.key)) {
    e.preventDefault();
  }
  if (e.repeat) return;

  if (e.key === "w" || e.key === "W" || e.code === "Space" || e.key === "ArrowUp") {
    tryJump();
  }

  if (e.code === "Digit1" || e.code === "Numpad1") selectSlot(0);
  if (e.code === "Digit2" || e.code === "Numpad2") selectSlot(1);
  if (e.code === "Digit3" || e.code === "Numpad3") selectSlot(2);
  if (e.code === "Digit4" || e.code === "Numpad4") selectSlot(3);
  if (e.code === "Digit5" || e.code === "Numpad5") selectSlot(4);

  keys.add(e.code);
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

const mouse = {
  x: 0,
  y: 0,
  worldX: 0,
  worldY: 0,
  left: false,
  right: false,
};

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouse.x = (e.clientX - rect.left) * scaleX;
  mouse.y = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.right = true;
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});

canvas.addEventListener("wheel", (e) => {
  if (e.deltaY > 0) {
    selectedIndex = (selectedIndex + 1) % INVENTORY.length;
  } else {
    selectedIndex = (selectedIndex - 1 + INVENTORY.length) % INVENTORY.length;
  }
  updateInventoryUI();
});

function tryJump() {
  if (player.onGround) {
    player.vy = -10.5;
    player.onGround = false;
  }
}

function selectSlot(index) {
  if (index >= 0 && index < INVENTORY.length) {
    selectedIndex = index;
    updateInventoryUI();
  }
}

function worldToTile(x, y) {
  return {
    tx: Math.floor(x / TILE),
    ty: Math.floor(y / TILE),
  };
}

function getBlock(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return "stone";
  return world[tx][ty];
}

function setBlock(tx, ty, type) {
  if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return;
  world[tx][ty] = type;
}

function rectCollides(x, y, width, height) {
  const minX = Math.floor((x - width / 2) / TILE);
  const maxX = Math.floor((x + width / 2) / TILE);
  const minY = Math.floor((y - height / 2) / TILE);
  const maxY = Math.floor((y + height / 2) / TILE);

  for (let tx = minX; tx <= maxX; tx++) {
    for (let ty = minY; ty <= maxY; ty++) {
      const block = getBlock(tx, ty);
      if (BLOCKS[block]?.solid) {
        return true;
      }
    }
  }
  return false;
}

function movePlayer(axis, amount) {
  if (amount === 0) return;

  const step = Math.sign(amount) * Math.min(Math.abs(amount), TILE / 4);
  let remaining = amount;
  while (Math.abs(remaining) > 0) {
    const move = Math.abs(remaining) < Math.abs(step) ? remaining : step;
    if (axis === "x") {
      const newX = player.x + move;
      if (!rectCollides(newX, player.y, player.width, player.height)) {
        player.x = newX;
        remaining -= move;
      } else {
        player.vx = 0;
        break;
      }
    } else {
      const newY = player.y + move;
      if (!rectCollides(player.x, newY, player.width, player.height)) {
        player.y = newY;
        remaining -= move;
      } else {
        if (move > 0) {
          player.onGround = true;
        }
        player.vy = 0;
        break;
      }
    }
  }
}

function applyPhysics() {
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");

  if (left === right) {
    player.vx *= FRICTION;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
  } else if (left) {
    player.vx = Math.max(player.vx - MOVE_SPEED, -MAX_SPEED_X);
  } else if (right) {
    player.vx = Math.min(player.vx + MOVE_SPEED, MAX_SPEED_X);
  }

  player.vy = Math.min(player.vy + GRAVITY, MAX_SPEED_Y);

  movePlayer("x", player.vx);
  player.onGround = false;
  movePlayer("y", player.vy);
}

function updateMouseWorldPosition(camera) {
  mouse.worldX = camera.x + mouse.x;
  mouse.worldY = camera.y + mouse.y;
}

let breakCooldown = 0;

function handleBlocks() {
  if (!mouse.left && !mouse.right) {
    breakCooldown = 0;
    return;
  }

  const { tx, ty } = worldToTile(mouse.worldX, mouse.worldY);

  if (mouse.left) {
    const block = getBlock(tx, ty);
    if (block !== "air" && block !== "bedrock") {
      if (breakCooldown <= 0) {
        setBlock(tx, ty, "air");
        breakCooldown = 8;
      } else {
        breakCooldown--;
      }
    }
  } else if (mouse.right) {
    const type = INVENTORY[selectedIndex];
    const block = getBlock(tx, ty);
    if (type !== "air" && block === "air") {
      // prevent placing inside player
      const blockCenterX = tx * TILE + TILE / 2;
      const blockCenterY = ty * TILE + TILE / 2;
      const collidesWithPlayer = rectCollides(
        blockCenterX,
        blockCenterY,
        TILE,
        TILE,
      );
      if (!collidesWithPlayer) {
        const below = getBlock(tx, ty + 1);
        if (ty === WORLD_HEIGHT - 1 || BLOCKS[below]?.solid || type === "wood") {
          setBlock(tx, ty, type);
          mouse.right = false; // prevent spam
        }
      }
    }
  }
}

function drawBackground(camera) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#74b9ff");
  gradient.addColorStop(0.6, "#97d5ff");
  gradient.addColorStop(1, "#fff0d6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sunX = ((camera.x / 30) % canvas.width) - 100;
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.arc(sunX, 100, 60, 0, Math.PI * 2);
  ctx.fill();
}

function drawWorld(camera) {
  const startX = Math.floor(camera.x / TILE);
  const startY = Math.floor(camera.y / TILE);
  const endX = Math.ceil((camera.x + canvas.width) / TILE);
  const endY = Math.ceil((camera.y + canvas.height) / TILE);

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      const block = getBlock(x, y);
      if (block === "air") continue;
      const blockInfo = BLOCKS[block];
      if (!blockInfo) continue;

      const screenX = x * TILE - camera.x;
      const screenY = y * TILE - camera.y;

      ctx.fillStyle = blockInfo.color;
      ctx.fillRect(screenX, screenY, TILE + 1, TILE + 1);

      if (block === "grass") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(screenX, screenY, TILE, TILE * 0.2);
      }
    }
  }
}

function drawPlayer(camera) {
  const screenX = player.x - camera.x;
  const screenY = player.y - camera.y;

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.fillStyle = "#ffe3c4";
  ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
  ctx.fillStyle = "#1f8ad0";
  ctx.fillRect(-player.width / 2, -player.height / 4, player.width, player.height / 2);
  ctx.restore();
}

function drawCursor(camera) {
  const { tx, ty } = worldToTile(mouse.worldX, mouse.worldY);
  const screenX = tx * TILE - camera.x;
  const screenY = ty * TILE - camera.y;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(screenX + 1, screenY + 1, TILE - 2, TILE - 2);
}

function updateInventoryUI() {
  const container = document.getElementById("inventory");
  container.innerHTML = "";
  INVENTORY.forEach((type, index) => {
    const slot = document.createElement("button");
    slot.className = "inventory-slot" + (index === selectedIndex ? " active" : "");
    slot.dataset.type = type;
    slot.dataset.key = index + 1;
    const block = document.createElement("span");
    slot.appendChild(block);
    slot.addEventListener("click", () => selectSlot(index));
    container.appendChild(slot);
  });
}

updateInventoryUI();

function clampCamera(camera) {
  camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH * TILE - canvas.width));
  camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT * TILE - canvas.height));
}

const camera = { x: 0, y: 0 };

function gameLoop() {
  applyPhysics();

  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;
  clampCamera(camera);

  updateMouseWorldPosition(camera);
  handleBlocks();

  drawBackground(camera);
  drawWorld(camera);
  drawPlayer(camera);
  drawCursor(camera);

  requestAnimationFrame(gameLoop);
}

gameLoop();
