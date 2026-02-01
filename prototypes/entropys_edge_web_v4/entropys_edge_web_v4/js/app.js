// Entropy's Edge v4 — Live RSVP PDE simulator

const canvas = document.getElementById('galaxy');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

// UI elements
const el = (id)=>document.getElementById(id);
const sliders = ['kPhi','kS','kv','lambda','gamma','muS','muV','dt'];
const toggles = ['showPhi','showEntropy','showVectors','showFactions'];
const selGrid = el('grid-size');

let params = { kPhi:0.8, kS:0.6, kv:0.4, lambda:0.2, gamma:0.3, muS:0.05, muV:0.08, dt:0.15 };
let show = { showPhi:true, showEntropy:true, showVectors:true, showFactions:false, arrowStep:3 };

let W=72, H=54, h=1.0;
let turn = 0;
let running = false;
let timer = null;
let margin = 60, tile = 14;

let Phi, S, vx, vy, owners;

function alloc() {
  Phi = new Float32Array(W*H);
  S   = new Float32Array(W*H);
  vx  = new Float32Array(W*H);
  vy  = new Float32Array(W*H);
  owners = new Uint8Array(W*H);
}
function idx(x,y){ x=(x+W)%W; y=(y+H)%H; return y*W+x; }

function smoothRandField(scale=1) {
  // simple smooth field via sums of sines
  const f = new Float32Array(W*H);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const v = 0.5 + 0.25*Math.sin(0.15*x+0.10*y) + 0.25*Math.sin(0.07*x-0.12*y);
      f[idx(x,y)] = scale * v;
    }
  }
  return f;
}

function initState(randomize=false) {
  alloc();
  if (randomize) {
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){
      Phi[idx(x,y)] = 0.8 + Math.random()*0.6;
      S[idx(x,y)]   = 0.4 + Math.random()*1.2;
      vx[idx(x,y)]  = (Math.random()-0.5)*0.1;
      vy[idx(x,y)]  = (Math.random()-0.5)*0.1;
      owners[idx(x,y)] = (x+y)%4;
    }
  } else {
    const P0 = smoothRandField(1.0);
    const S0 = smoothRandField(1.0);
    for (let i=0;i<W*H;i++){
      Phi[i] = 0.8 + 0.5*P0[i];
      S[i]   = 0.4 + 0.8*S0[i];
      vx[i]  = 0.0; vy[i]=0.0;
      owners[i] = i % 4;
    }
  }
  turn = 0;
}

function laplace(U) {
  const out = new Float32Array(W*H);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i = idx(x,y);
      const up = idx(x,y-1), dn=idx(x,y+1), lt=idx(x-1,y), rt=idx(x+1,y);
      out[i] = (U[up]+U[dn]+U[lt]+U[rt]-4*U[i])/(h*h);
    }
  }
  return out;
}
function grad(U) {
  const gx=new Float32Array(W*H), gy=new Float32Array(W*H);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i = idx(x,y);
      const rt=idx(x+1,y), lt=idx(x-1,y), dn=idx(x,y+1), up=idx(x,y-1);
      gx[i]=(U[rt]-U[lt])/(2*h);
      gy[i]=(U[dn]-U[up])/(2*h);
    }
  }
  return [gx, gy];
}
function div(vx, vy) {
  const out=new Float32Array(W*H);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=idx(x,y);
      const r=idx(x+1,y), l=idx(x-1,y), d=idx(x,y+1), u=idx(x,y-1);
      const dvx_dx=(vx[r]-vx[l])/(2*h);
      const dvy_dy=(vy[d]-vy[u])/(2*h);
      out[i]=dvx_dx+dvy_dy;
    }
  }
  return out;
}

function stepPDE() {
  const dt = params.dt;
  // compute operators
  const lapP = laplace(Phi);
  const lapS = laplace(S);
  const [gPx, gPy] = grad(Phi);
  const [gSx, gSy] = grad(S);
  const divv = div(vx, vy);
  const [gdivx, gdivy] = grad(divv);
  const lapVx = laplace(vx);
  const lapVy = laplace(vy);

  // curlcurl(v) ~ grad(div v) - lap v
  for (let i=0;i<W*H;i++){
    Phi[i] += dt * (params.kPhi * lapP[i] - params.lambda * S[i]);
    const gradPhi2 = gPx[i]*gPx[i] + gPy[i]*gPy[i];
    S[i]   += dt * (params.kS * lapS[i] + params.gamma * gradPhi2 - params.muS * S[i]);
    const ccx = gdivx[i] - lapVx[i];
    const ccy = gdivy[i] - lapVy[i];
    vx[i]  += dt * (params.kv * ccx - gSx[i] - params.muV * vx[i]);
    vy[i]  += dt * (params.kv * ccy - gSy[i] - params.muV * vy[i]);
    // clamp
    if (Phi[i] < 0) Phi[i]=0; if (Phi[i]>3) Phi[i]=3;
    if (S[i] < 0) S[i]=0; if (S[i]>3) S[i]=3;
  }
  turn += 1;
}

function S_to_color(S) {
  const s = Math.max(0, Math.min(1, S / 3.0));
  const hue = (1 - s) * 240;
  return `hsl(${hue}, 100%, 55%)`;
}

function draw() {
  const tileSize = tile, m = margin;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=idx(x,y);
      const color = show.showEntropy ? S_to_color(S[i]) : '#000';
      const bright = show.showPhi ? Math.max(0.2, Math.min(1.0, Phi[i]/3.0)) : 1.0;
      ctx.globalAlpha = bright;
      ctx.fillStyle = color;
      ctx.fillRect(m + x*tileSize, m + y*tileSize, tileSize-1, tileSize-1);

      if (show.showFactions) {
        const f = owners[i] % 4;
        const overlay = ['#00F4','#0F04','#F004','#FF04'][f];
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = overlay;
        ctx.fillRect(m + x*tileSize, m + y*tileSize, tileSize-1, tileSize-1);
      }
    }
  }
  ctx.globalAlpha = 1.0;

  if (show.showVectors) {
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    const step = parseInt(el('arrowStep').value || show.arrowStep);
    for (let y=0;y<H;y+=step){
      for (let x=0;x<W;x+=step){
        const i=idx(x,y);
        const cx = margin + x*tile + tile/2;
        const cy = margin + y*tile + tile/2;
        const scale = 6.0;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + vx[i]*scale, cy + vy[i]*scale);
        ctx.stroke();
      }
    }
  }

  statusEl.textContent = `Turn ${turn} — ${W}x${H}`;
}

function loop() {
  if (!running) return;
  // basic CFL guard: dt <= h^2 /(4*max(k))
  const maxk = Math.max(params.kPhi, params.kS, params.kv);
  const dtmax = (h*h)/(4*maxk);
  if (params.dt > dtmax) {
    // integrate multiple small substeps if dt is large
    const sub = Math.ceil(params.dt / dtmax);
    const olddt = params.dt;
    params.dt = olddt / sub;
    for (let i=0;i<sub;i++) stepPDE();
    params.dt = olddt;
  } else {
    stepPDE();
  }
  draw();
  requestAnimationFrame(loop);
}

// UI bindings
function bindSliders() {
  sliders.forEach(k=>{
    const s = el(k), v = el(k+'Val');
    const update = ()=>{ params[k]=parseFloat(s.value); v.textContent = parseFloat(s.value).toFixed(2); };
    s.addEventListener('input', update); update();
  });
  el('arrowStep').addEventListener('input', ()=> draw());
  toggles.forEach(id=>{
    const t = el(id);
    t.addEventListener('change', ()=>{ show[id]=t.checked; draw(); });
    show[id] = t.checked;
  });
  el('btn-start').onclick = ()=>{ if(!running){ running=true; loop(); } };
  el('btn-pause').onclick = ()=>{ running=false; };
  el('btn-step').onclick = ()=>{ stepPDE(); draw(); };
  el('btn-reset').onclick = ()=>{ initState(false); draw(); };
  el('btn-rand').onclick = ()=>{ initState(true); draw(); };
  el('btn-snap').onclick = ()=>{
    const a = document.createElement('a');
    a.download = `entropy_edge_v4_turn${turn}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  selGrid.onchange = ()=>{
    const v = selGrid.value;
    if (v==='small'){ W=48; H=36; tile=16; margin=50; }
    if (v==='medium'){ W=72; H=54; tile=14; margin=60; }
    if (v==='large'){ W=96; H=72; tile=12; margin=60; }
    initState(false); draw();
  };
}

function main() {
  bindSliders();
  initState(false);
  draw();
}

main();
