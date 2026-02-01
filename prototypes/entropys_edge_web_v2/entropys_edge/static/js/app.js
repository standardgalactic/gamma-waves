const canvas = document.getElementById('galaxy');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const btnNext = document.getElementById('btn-next');
const btn10 = document.getElementById('btn-10');
const btnReseed = document.getElementById('btn-reseed');

let state = null;
let tileSize = 22;
let margin = 60;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);


function S_to_color(S) {
  // Map S in [0, ~3] to hue 240->0
  const s = Math.max(0, Math.min(1, S / 3.0));
  const hue = (1 - s) * 240; // blue to red
  return `hsl(${hue},100%,55%)`;
}

function draw() {
  if (!state) return;
  const w = state.width, h = state.height;
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // draw tiles
  for (const t of state.tiles) {
    const x = margin + t.x * tileSize;
    const y = margin + t.y * tileSize;
    ctx.fillStyle = S_to_color(t.S);
    // brightness via Phi
    const bright = Math.max(0.2, Math.min(1.0, t.phi / 3.0));
    ctx.globalAlpha = bright;
    ctx.fillRect(x, y, tileSize-1, tileSize-1);
    ctx.globalAlpha = 1.0;
  }

  // draw vector arrows (downsampled)
  ctx.strokeStyle = '#ddd';
  for (const a of state.arrows) {
    const x = margin + a.x * tileSize + (tileSize/2);
    const y = margin + a.y * tileSize + (tileSize/2);
    const scale = 6.0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + a.vx * scale, y + a.vy * scale);
    ctx.stroke();
  }

  // status
  statusEl.textContent = `Turn ${state.turn}`;
}

async function fetchState() {
  const res = await fetch('/api/get_state');
  state = await res.json();
  draw();
}

btnNext.onclick = async () => {
  await fetch('/api/next_turn', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({steps:1})});
  await fetchState();
};
btn10.onclick = async () => {
  await fetch('/api/next_turn', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({steps:10})});
  await fetchState();
};
btnReseed.onclick = async () => {
  const seed = Math.floor(Math.random()*1e6);
  await fetch('/api/new_game', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({width:40, height:30, seed})});
  await fetchState();
};

// click to place an Entropy Pump
canvas.addEventListener('click', async (ev) => {
  if (!state) return;
  const rect = canvas.getBoundingClientRect();
  const cx = ev.clientX - rect.left;
  const cy = ev.clientY - rect.top;
  const x = Math.floor((cx - margin) / tileSize);
  const y = Math.floor((cy - margin) / tileSize);
  if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
    await fetch('/api/build', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({x,y,name:'Entropy Pump'})});
    await fetchState();
  }
});

// init
fetchState();


// Modal helpers
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
document.getElementById('modal-close').onclick = () => modal.classList.add('hidden');
function showModal(title, html) { modalTitle.textContent = title; modalBody.innerHTML = html; modal.classList.remove('hidden'); }

const btnDiplo = document.getElementById('btn-diplo');
const btnTech = document.getElementById('btn-tech');
const gridSelect = document.getElementById('grid-select');

btnDiplo.onclick = async () => {
  const res = await fetch('/api/diplomacy');
  const data = await res.json();
  let html = '<h3>Ethics Means per Faction</h3><p>' + data.ethics_means.map(x=>x.toFixed(3)).join(', ') + '</p>';
  html += '<h3>Alignment Matrix</h3><table><thead><tr><th></th>';
  for (let i=0;i<data.factions;i++) html += `<th>F${i}</th>`;
  html += '</tr></thead><tbody>';
  for (let i=0;i<data.factions;i++) {
    html += `<tr><th>F${i}</th>`;
    for (let j=0;j<data.factions;j++) {
      html += `<td>${data.alignment[i][j].toFixed(3)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  showModal('Diplomacy & Ethics', html);
};

btnTech.onclick = async () => {
  const res = await fetch('/api/tech_tree');
  const tree = await res.json();
  let html = '<table><thead><tr><th>Tech</th><th>Description</th><th>Prereq</th><th>Unlock (Faction 0)</th></tr></thead><tbody>';
  for (const [k,v] of Object.entries(tree)) {
    const pre = v.prereq.join(', ') || '—';
    html += `<tr><td>${k}</td><td>${v.desc}</td><td>${pre}</td><td><button data-tech="${k}" class="unlock">Unlock</button></td></tr>`;
  }
  html += '</tbody></table>';
  showModal('Technology', html);
  for (const b of modalBody.querySelectorAll('button.unlock')) {
    b.onclick = async () => {
      await fetch('/api/unlock', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({faction:0, tech:b.dataset.tech})});
      b.textContent = 'Unlocked ✓';
      b.disabled = true;
    };
  }
};

gridSelect.onchange = async () => {
  const grid = gridSelect.value;
  await fetch('/api/new_game', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({width:40, height:30, seed: Math.floor(Math.random()*1e6), grid})});
  await fetchState();
};

// Hex rendering
function axialToPixel(a, b, size) {
  const sqrt3 = Math.sqrt(3);
  const x = size * (a + 0.5 * b);
  const y = size * (sqrt3/2) * b;
  return {x, y};
}
function drawHex(ctx, cx, cy, size, fill, alpha=1.0) {
  const sqrt3 = Math.sqrt(3);
  ctx.beginPath();
  for (let i=0;i<6;i++) {
    const ang = Math.PI/3 * i + Math.PI/6; // pointy-top
    const px = cx + size * Math.cos(ang);
    const py = cy + size * Math.sin(ang);
    if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

let useHex = false;

function drawHexMap() {
  if (!state) return;
  const w = state.width, h = state.height;
  ctx.clearRect(0,0,canvas.width, canvas.height);
  const size = tileSize;

  for (const t of state.tiles) {
    const a = t.x, b = t.y; // reuse x->a, y->b
    const p = axialToPixel(a, b, size);
    const cx = margin + p.x + (t.y%2 ? size*0.0 : 0); // simple staggering not required for axial->pixel
    const cy = margin + p.y;
    const color = S_to_color(t.S);
    const bright = Math.max(0.25, Math.min(1.0, t.phi / 3.0));
    drawHex(ctx, cx, cy, size*0.6, color, bright);
  }
  // arrows (approximate)
  ctx.strokeStyle = '#ddd';
  for (const a of state.arrows) {
    const p = axialToPixel(a.x, a.y, size);
    const cx = margin + p.x;
    const cy = margin + p.y;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + a.vx * 6.0, cy + a.vy * 6.0);
    ctx.stroke();
  }
  statusEl.textContent = `Turn ${state.turn} (hex grid)`;
}

// Override draw() to switch based on grid mode by sniffing state shape
const _drawSquare = draw;
draw = function() {
  if (useHex) { drawHexMap(); return; }
  _drawSquare();
};

// Detect grid mode via dropdown
gridSelect.addEventListener('change', () => {
  useHex = (gridSelect.value === 'hex');
});

// Also set useHex on first load based on select default
useHex = (gridSelect.value === 'hex');
