const canvas = document.getElementById('galaxy');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let tileSize = 20;
let margin = 50;
let turn = 0;
let states = [];
let autoPlay = false;
let autoTimer = null;

function S_to_color(S) {
  const s = Math.max(0, Math.min(1, S / 3.0));
  const hue = (1 - s) * 240;
  return `hsl(${hue}, 100%, 55%)`;
}

function draw(state) {
  if (!state) return;
  const w = state.width, h = state.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const t of state.tiles) {
    const x = margin + t.x * tileSize;
    const y = margin + t.y * tileSize;
    const color = S_to_color(t.S);
    const bright = Math.max(0.2, Math.min(1.0, t.phi / 3.0));
    ctx.globalAlpha = bright;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, tileSize - 1, tileSize - 1);
  }
  ctx.globalAlpha = 1.0;

  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  for (const a of state.arrows) {
    const x = margin + a.x * tileSize + tileSize / 2;
    const y = margin + a.y * tileSize + tileSize / 2;
    const scale = 6.0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + a.vx * scale, y + a.vy * scale);
    ctx.stroke();
  }

  statusEl.textContent = `Turn ${state.turn} / ${states.length - 1}`;
}

async function loadStates() {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(`data/state${i}.json`);
      const js = await res.json();
      states.push(js);
    } catch (e) { break; }
  }
  draw(states[0]);
}

document.getElementById('btn-next').onclick = () => {
  turn = Math.min(turn + 1, states.length - 1);
  draw(states[turn]);
};
document.getElementById('btn-prev').onclick = () => {
  turn = Math.max(turn - 1, 0);
  draw(states[turn]);
};
document.getElementById('btn-restart').onclick = () => {
  turn = 0; draw(states[0]);
};
document.getElementById('btn-auto').onclick = () => {
  autoPlay = !autoPlay;
  if (autoPlay) {
    autoTimer = setInterval(() => {
      turn = (turn + 1) % states.length;
      draw(states[turn]);
    }, 600);
  } else {
    clearInterval(autoTimer);
  }
};

loadStates();
