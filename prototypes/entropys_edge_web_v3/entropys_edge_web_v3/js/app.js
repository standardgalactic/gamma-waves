const canvas = document.getElementById('galaxy');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let tileSize = 20;
let margin = 50;
let turn = 0;
let states = [];
let autoPlay = false;
let autoTimer = null;

// Parameters
let params = {kPhi:1,kS:1,lambda:0.2,gamma:0.3,muS:0.05,arrowStep:3,
              showPhi:true,showEntropy:true,showVectors:true,showFactions:false};

// Update slider displays
function bindSlider(id, key) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(id+'Val');
  el.oninput = () => { params[key] = parseFloat(el.value); valEl.textContent = el.value; draw(states[turn]); };
}
['kPhi','kS','lambda','gamma','muS'].forEach(k=>bindSlider(k,k));
document.getElementById('arrowStep').oninput = e => { params.arrowStep = parseInt(e.target.value); draw(states[turn]); };

['showPhi','showEntropy','showVectors','showFactions'].forEach(id=>{
  const el=document.getElementById(id);
  el.onchange=()=>{params[id]=el.checked; draw(states[turn]);};
});

function S_to_color(S) {
  const s = Math.max(0, Math.min(1, S / 3.0));
  const hue = (1 - s) * 240;
  return `hsl(${hue}, 100%, 55%)`;
}

function draw(state) {
  if (!state) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const t of state.tiles) {
    const x = margin + t.x * tileSize;
    const y = margin + t.y * tileSize;
    let color = '#000';

    if (params.showEntropy) color = S_to_color(t.S * params.kS);
    const bright = params.showPhi ? Math.max(0.2, Math.min(1.0, t.phi * params.kPhi / 3.0)) : 1.0;

    ctx.globalAlpha = bright;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, tileSize - 1, tileSize - 1);

    if (params.showFactions) {
      const fcol = ['#00f2','#0f02','#f002','#ff02'][t.owner % 4];
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = fcol;
      ctx.fillRect(x, y, tileSize-1, tileSize-1);
    }
  }
  ctx.globalAlpha = 1.0;

  if (params.showVectors) {
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (const a of state.arrows) {
      if (a.x % params.arrowStep !== 0 || a.y % params.arrowStep !== 0) continue;
      const x = margin + a.x * tileSize + tileSize / 2;
      const y = margin + a.y * tileSize + tileSize / 2;
      const scale = 6.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + a.vx * scale, y + a.vy * scale);
      ctx.stroke();
    }
  }

  statusEl.textContent = `Turn ${state.turn}`;
}

// Snapshot
document.getElementById('btn-save').onclick = ()=>{
  const link = document.createElement('a');
  link.download = `entropy_edge_turn${turn}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

async function loadStates() {
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(`data/state${i}.json`);
      const js = await res.json();
      states.push(js);
    } catch { break; }
  }
  draw(states[0]);
}

document.getElementById('btn-next').onclick = ()=>{ turn=Math.min(turn+1,states.length-1); draw(states[turn]); };
document.getElementById('btn-prev').onclick = ()=>{ turn=Math.max(turn-1,0); draw(states[turn]); };
document.getElementById('btn-restart').onclick = ()=>{ turn=0; draw(states[0]); };
document.getElementById('btn-auto').onclick = ()=>{
  autoPlay=!autoPlay;
  if(autoPlay){
    autoTimer=setInterval(()=>{turn=(turn+1)%states.length;draw(states[turn]);},500);
  }else clearInterval(autoTimer);
};

loadStates();
