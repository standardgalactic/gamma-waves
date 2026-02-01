// Entropy's Edge v6 — Buildings + AI + Ownership + Save/Load + everything from v5

const canvas = document.getElementById('galaxy');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const el = (id)=>document.getElementById(id);
const sliders = ['kPhi','kS','kv','lambda','gamma','muS','muV','dt','cycle','lamBoost','dynBoost','epsilon'];
const toggles = ['showPhi','showEntropy','showVectors','showFactions'];

let params = { kPhi:0.8, kS:0.6, kv:0.4, lambda:0.2, gamma:0.3, muS:0.05, muV:0.08, dt:0.15,
               cycle:20, lamBoost:1.25, dynBoost:1.25, epsilon:0.01 };
let show = { showPhi:true, showEntropy:true, showVectors:true, showFactions:false };

let W=72, H=54, h=1.0, tile=14, margin=60;
let turn=0, running=false;
let phase='Lamphron', phaseCounter=0, frozen=false;

let Phi, S, vx, vy, owners, buildings;
let tech = { entropyPump:true, lamphrodyneMirror:false, torsionLandauer:false, inflatonSeed:false };

const TOAST = el('toast');
function toast(msg){ TOAST.textContent = msg; TOAST.classList.remove('hidden'); setTimeout(()=>TOAST.classList.add('hidden'), 1400); }

function idx(x,y){ x=(x+W)%W; y=(y+H)%H; return y*W+x; }
function alloc(){
  Phi=new Float32Array(W*H); S=new Float32Array(W*H);
  vx=new Float32Array(W*H); vy=new Float32Array(W*H);
  owners=new Uint8Array(W*H);
  buildings=Array.from({length:W*H}, ()=>({pump:false, mirror:false, torsion:false}));
}
function smoothInit() {
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      Phi[idx(x,y)] = 0.8 + 0.5*(0.5 + 0.25*Math.sin(0.15*x+0.10*y)+0.25*Math.sin(0.07*x-0.12*y));
      S[idx(x,y)]   = 0.4 + 0.8*(0.5 + 0.25*Math.sin(0.12*x-0.08*y)+0.25*Math.sin(0.06*x+0.09*y));
      vx[idx(x,y)]  = 0; vy[idx(x,y)] = 0;
      owners[idx(x,y)] = (x+y)%4;
    }
  }
}
function randomize() {
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      Phi[idx(x,y)] = 0.8 + Math.random()*0.6;
      S[idx(x,y)]   = 0.4 + Math.random()*1.2;
      vx[idx(x,y)]  = (Math.random()-0.5)*0.1;
      vy[idx(x,y)]  = (Math.random()-0.5)*0.1;
      owners[idx(x,y)] = (x + y) % 4;
    }
  }
}
function reset(uniform=false){
  alloc(); if (uniform) smoothInit(); else randomize();
  turn=0; phase='Lamphron'; phaseCounter=0; frozen=false;
  el('phaseName').textContent = phase;
  el('btn-inflaton').disabled = true;
}

function laplace(U) {
  const out = new Float32Array(W*H);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=idx(x,y), up=idx(x,y-1), dn=idx(x,y+1), lt=idx(x-1,y), rt=idx(x+1,y);
      out[i]=(U[up]+U[dn]+U[lt]+U[rt]-4*U[i])/(h*h);
    }
  }
  return out;
}
function grad(U){
  const gx=new Float32Array(W*H), gy=new Float32Array(W*H);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=idx(x,y), rt=idx(x+1,y), lt=idx(x-1,y), dn=idx(x,y+1), up=idx(x,y-1);
      gx[i]=(U[rt]-U[lt])/(2*h); gy[i]=(U[dn]-U[up])/(2*h);
    }
  }
  return [gx, gy];
}
function div(vx,vy){
  const out=new Float32Array(W*H);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=idx(x,y), r=idx(x+1,y), l=idx(x-1,y), d=idx(x,y+1), u=idx(x,y-1);
      out[i]=(vx[r]-vx[l])/(2*h) + (vy[d]-vy[u])/(2*h);
    }
  }
  return out;
}

function applyPhaseMultipliers() {
  const lam = parseFloat(el('lamBoost').value || params.lamBoost);
  const dyn = parseFloat(el('dynBoost').value || params.dynBoost);
  if (phase==='Lamphron') {
    return { kPhi: params.kPhi*lam, kS: params.kS, kv: params.kv, lambda: params.lambda/lam, gamma: params.gamma*lam, muS: params.muS*0.8, muV: params.muV, dt: params.dt };
  } else {
    return { kPhi: params.kPhi, kS: params.kS*dyn, kv: params.kv*dyn, lambda: params.lambda*dyn, gamma: params.gamma, muS: params.muS*1.5, muV: params.muV, dt: params.dt };
  }
}

function buildingEffects() {
  // Apply per-tile building modifiers
  for (let i=0;i<W*H;i++){
    if (buildings[i].pump && tech.entropyPump) { const take = 0.03 * S[i]; Phi[i]+=take; S[i]-=take; }
  }
  if (tech.lamphrodyneMirror) {
    // Smooth S but emphasize tiles with mirrors
    const ls = laplace(S);
    for (let i=0;i<W*H;i++){ const factor = buildings[i].mirror ? 0.1 : 0.03; S[i] += factor * ls[i]; }
  }
  if (tech.torsionLandauer) {
    // Additional damping near torsion nodes
    const lvx = laplace(vx), lvy = laplace(vy);
    for (let i=0;i<W*H;i++){ const damp = buildings[i].torsion ? 0.05 : 0.02; vx[i] -= damp * lvx[i]; vy[i] -= damp * lvy[i]; }
  }
}

function aiEmpires() {
  // Simple policy per faction: 0 Constructors (boost Phi), 1 Voyagers (boost flows), 2 Archivists (reduce S), 3 Catalysts (perturb + expand)
  for (let f=0; f<4; f++){
    // Target ~5% of tiles they own each step
    const target = Math.max(1, Math.floor(W*H*0.05/4));
    let acted = 0, attempts = 0;
    while (acted < target && attempts < W*H){
      attempts++;
      const x = (Math.random()*W)|0, y = (Math.random()*H)|0, i = idx(x,y);
      if ((owners[i]%4)!==f) continue;
      if (f===0) { Phi[i] = Math.min(3, Phi[i] + 0.01); }                // Constructors
      if (f===1) { vx[i] += 0.01*(Math.random()-0.5); vy[i]+=0.01*(Math.random()-0.5); } // Voyagers
      if (f===2) { S[i] = Math.max(0, S[i] - 0.01); }                    // Archivists
      if (f===3) { Phi[i] += (Math.random()-0.5)*0.02; S[i]+= (Math.random()-0.5)*0.02; } // Catalysts
      acted++;
    }
  }
}

function ownershipDiffusion() {
  // Influence = Phi*(1-S_norm) + buildings bonus; neighbor majority flips tile with small probability
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=idx(x,y);
      const S_norm = Math.min(1, Math.max(0, S[i]/3));
      const baseInflu = Phi[i]*(1 - S_norm);
      const bonus = (buildings[i].pump?0.2:0) + (buildings[i].mirror?0.1:0) + (buildings[i].torsion?0.1:0);
      const selfInfl = baseInflu + bonus;

      let counts = [0,0,0,0], infl = [0,0,0,0];
      const ns = [idx(x+1,y), idx(x-1,y), idx(x,y+1), idx(x,y-1)];
      for (const j of ns){
        const f = owners[j]%4;
        const Sj = Math.min(1, Math.max(0, S[j]/3));
        const inflj = Phi[j]*(1 - Sj) + (buildings[j].pump?0.2:0) + (buildings[j].mirror?0.1:0) + (buildings[j].torsion?0.1:0);
        counts[f]++; infl[f]+=inflj;
      }
      const myF = owners[i]%4;
      let bestF = myF; let bestI = selfInfl;
      for (let f=0; f<4; f++){
        if (infl[f] > bestI*1.15 && counts[f] >= 2) { bestF = f; bestI = infl[f]; }
      }
      // probabilistic flip
      if (bestF !== myF && Math.random() < 0.1) owners[i] = bestF;
    }
  }
}

function applyPhaseSchedule() {
  phaseCounter += 1;
  const cyc = parseInt(el('cycle').value || params.cycle);
  if (phaseCounter >= cyc) {
    phaseCounter = 0;
    phase = (phase==='Lamphron') ? 'Lamphrodyne' : 'Lamphron';
    el('phaseName').textContent = phase;
  }
}

function stepPDE() {
  const lam = parseFloat(el('lamBoost').value || params.lamBoost);
  const dyn = parseFloat(el('dynBoost').value || params.dynBoost);
  const phaseParams = (phase==='Lamphron')
    ? { kPhi: params.kPhi*lam, kS: params.kS, kv: params.kv, lambda: params.lambda/lam, gamma: params.gamma*lam, muS: params.muS*0.8, muV: params.muV, dt: params.dt }
    : { kPhi: params.kPhi, kS: params.kS*dyn, kv: params.kv*dyn, lambda: params.lambda*dyn, gamma: params.gamma, muS: params.muS*1.5, muV: params.muV, dt: params.dt };

  // CFL guard
  const maxk = Math.max(phaseParams.kPhi, phaseParams.kS, phaseParams.kv);
  const dtmax = (h*h)/(4*maxk);
  let steps = 1, localDt = phaseParams.dt;
  if (localDt > dtmax) { steps = Math.ceil(localDt / dtmax); localDt /= steps; }

  for (let s=0; s<steps; s++){
    const lapP = laplace(Phi);
    const lapS = laplace(S);
    const [gPx,gPy] = grad(Phi);
    const [gSx,gSy] = grad(S);
    const lapVx = laplace(vx);
    const lapVy = laplace(vy);
    const dv = div(vx,vy);
    const [gdivx,gdivy] = grad(dv);

    for (let i=0;i<W*H;i++){
      Phi[i] += localDt * (phaseParams.kPhi * lapP[i] - phaseParams.lambda * S[i]);
      const gradPhi2 = gPx[i]*gPx[i] + gPy[i]*gPy[i];
      S[i]   += localDt * (phaseParams.kS * lapS[i] + phaseParams.gamma * gradPhi2 - phaseParams.muS * S[i]);
      const ccx = gdivx[i] - lapVx[i];
      const ccy = gdivy[i] - lapVy[i];
      vx[i]  += localDt * (phaseParams.kv * ccx - gSx[i] - params.muV * vx[i]);
      vy[i]  += localDt * (phaseParams.kv * ccy - gSy[i] - params.muV * vy[i]);
      if (Phi[i]<0) Phi[i]=0; if (Phi[i]>3) Phi[i]=3;
      if (S[i]<0) S[i]=0; if (S[i]>3) S[i]=3;
    }

    buildingEffects();
    aiEmpires();
    ownershipDiffusion();
  }

  // Freeze detection
  const [gPx2,gPy2] = grad(Phi);
  const [gSx2,gSy2] = grad(S);
  let G=0; for (let i=0;i<W*H;i++) G += gPx2[i]*gPx2[i] + gPy2[i]*gPy2[i] + gSx2[i]*gSx2[i] + gSy2[i]*gSy2[i];
  G /= (W*H);
  if (G < params.epsilon && !frozen) { frozen = true; running=false; el('btn-inflaton').disabled = !tech.inflatonSeed; toast('Expyrosis: field frozen'); }

  applyPhaseSchedule();
  turn += 1;
}

function inflatonSeed() {
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const i=idx(x,y); Phi[i] += (Math.random()-0.5)*0.05; if (Phi[i]<0) Phi[i]=0; if (Phi[i]>3) Phi[i]=3; }
  phase='Lamphron'; el('phaseName').textContent = phase;
  frozen=false; running=true; el('btn-inflaton').disabled = true; loop();
}

function S_to_color(S) {
  const s = Math.max(0, Math.min(1, S / 3.0));
  const hue = (1 - s) * 240;
  return `hsl(${hue}, 100%, 55%)`;
}

function drawHexCell(cx,cy,size,fill,alpha=1.0){
  const sqrt3 = Math.sqrt(3);
  ctx.beginPath();
  for (let i=0;i<6;i++){
    const ang = Math.PI/3 * i + Math.PI/6;
    const px = cx + size*Math.cos(ang);
    const py = cy + size*Math.sin(ang);
    if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath();
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1.0;
}

function draw() {
  const hex = el('hexMode').checked;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=idx(x,y);
      const color = show.showEntropy ? S_to_color(S[i]) : '#000';
      const bright = show.showPhi ? Math.max(0.2, Math.min(1.0, Phi[i]/3.0)) : 1.0;
      let fov = owners[i]%4;

      if (!hex) {
        ctx.globalAlpha = bright; ctx.fillStyle = color;
        ctx.fillRect(margin + x*tile, margin + y*tile, tile-1, tile-1);
        if (show.showFactions){ ctx.globalAlpha = 0.15; ctx.fillStyle = ['#00F4','#0F04','#F004','#FF04'][fov]; ctx.fillRect(margin + x*tile, margin + y*tile, tile-1, tile-1); }
        ctx.globalAlpha = 1.0;
      } else {
        const cx = margin + x*tile + tile/2 + (y%2 ? tile*0.3 : 0);
        const cy = margin + y*tile + tile/2;
        const size = tile*0.55;
        drawHexCell(cx, cy, size, color, bright);
        if (show.showFactions){ ctx.globalAlpha = 0.15; drawHexCell(cx, cy, size, ['#00F4','#0F04','#F004','#FF04'][fov], 0.15); ctx.globalAlpha = 1.0; }
      }

      // building glyphs
      const gx = margin + x*tile + tile/2 + (hex && (y%2) ? tile*0.3 : 0);
      const gy = margin + y*tile + tile/2;
      ctx.save(); ctx.translate(gx,gy);
      let n=0;
      if (buildings[i].pump){ ctx.fillStyle='#8cf'; ctx.fillRect(-3,-3,6,6); n++; }
      if (buildings[i].mirror){ ctx.strokeStyle='#fc8'; ctx.strokeRect(-5,-5,10,10); n++; }
      if (buildings[i].torsion){ ctx.beginPath(); ctx.arc(0,0,5,0,2*Math.PI); ctx.strokeStyle='#c8f'; ctx.stroke(); n++; }
      ctx.restore();
    }
  }

  if (show.showVectors){
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    const step = parseInt(el('arrowStep').value || 3);
    for (let y=0;y<H;y+=step){
      for (let x=0;x<W;x+=step){
        const i=idx(x,y);
        const cx = margin + x*tile + tile/2 + (el('hexMode').checked && (y%2) ? tile*0.3 : 0);
        const cy = margin + y*tile + tile/2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + vx[i]*6.0, cy + vy[i]*6.0);
        ctx.stroke();
      }
    }
  }

  statusEl.textContent = `Turn ${turn} — ${W}x${H} — Phase: ${phase}${frozen?' (Frozen)':''}`;
}

function loop() {
  if (!running) return;
  stepPDE();
  draw();
  requestAnimationFrame(loop);
}

// Diplomacy / Ethics
function ethicsTensor() {
  const [gvx_x, gvx_y] = grad(vx);
  const [gvy_x, gvy_y] = grad(vy);
  const [gPx, gPy] = grad(Phi);
  const E = new Float32Array(W*H);
  for (let i=0;i<W*H;i++) E[i] = gvx_x[i]*gPx[i] + gvy_y[i]*gPy[i];
  return E;
}
function alignmentMatrix(E) {
  const factions = 4;
  const means = new Array(factions).fill(0);
  const counts = new Array(factions).fill(0);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const i=idx(x,y); const f=owners[i]%factions; means[f]+=E[i]; counts[f]++; }
  for (let f=0; f<factions; f++) means[f] = counts[f] ? means[f]/counts[f] : 0;
  const norm = Math.sqrt(means.reduce((a,b)=>a+b*b,0)) || 1;
  const v = means.map(m=>m/norm);
  const A = Array.from({length:factions}, (_,i)=> Array.from({length:factions},(_,j)=> v[i]*v[j]));
  return {means, A};
}
function showDiplomacyModal() {
  const E = ethicsTensor();
  const {means, A} = alignmentMatrix(E);
  let html = '<h3>Ethics Means per Faction</h3><p>' + means.map(x=>x.toFixed(3)).join(', ') + '</p>';
  html += '<h3>Alignment Matrix</h3><table><thead><tr><th></th>';
  for (let i=0;i<4;i++) html += `<th>F${i}</th>`;
  html += '</tr></thead><tbody>';
  for (let i=0;i<4;i++){ html += `<tr><th>F${i}</th>`; for (let j=0;j<4;j++){ html += `<td>${A[i][j].toFixed(3)}</td>`; } html += '</tr>'; }
  html += '</tbody></table>';
  showModal('Diplomacy & Ethics', html);
}

// Tech modal
function showTechModal() {
  const rows = [
    ['Entropy Pump', 'Convert local S → Φ each step.', '—', tech.entropyPump],
    ['Lamphrodyne Mirror', 'Diffuse entropy with extra smoothing.', 'Entropy Pump', tech.lamphrodyneMirror],
    ['Torsion–Landauer Filter', 'Damp vortical (curl) modes.', 'Lamphrodyne Mirror', tech.torsionLandauer],
    ['Inflaton Seed', 'Rebirth after freeze (Expyrosis).', 'Torsion–Landauer Filter', tech.inflatonSeed],
  ];
  let html = '<table><thead><tr><th>Tech</th><th>Description</th><th>Prereq</th><th>Status</th></tr></thead><tbody>';
  for (const r of rows){
    const [name,desc,pre,unlocked] = r;
    const id = name.replace(/[^a-z]/gi,'').toLowerCase();
    html += `<tr><td>${name}</td><td>${desc}</td><td>${pre}</td><td>`;
    if (unlocked) html += 'Unlocked ✓';
    else html += `<button data-tech="${id}" class="unlock">Unlock</button>`;
    html += '</td></tr>';
  }
  html += '</tbody></table>';
  showModal('Technology', html);
  for (const b of el('modal-body').querySelectorAll('button.unlock')){
    b.onclick = ()=>{
      const t = b.dataset.tech;
      if (t==='lamphrodynemirror' && !tech.entropyPump) return alert('Requires Entropy Pump');
      if (t==='torsionlandauerfilter' && !tech.lamphrodyneMirror) return alert('Requires Lamphrodyne Mirror');
      if (t==='inflatonseed' && !tech.torsionLandauer) return alert('Requires Torsion–Landauer Filter');
      if (t==='entropypump') tech.entropyPump = true;
      if (t==='lamphrodynemirror') tech.lamphrodyneMirror = true;
      if (t==='torsionlandauerfilter') tech.torsionLandauer = true;
      if (t==='inflatonseed') tech.inflatonSeed = true;
      if (t==='inflatonseed') el('btn-inflaton').disabled = !frozen;
      b.textContent = 'Unlocked ✓'; b.disabled = true;
    };
  }
}

// Modal helpers
const modal = el('modal'); const modalTitle = el('modal-title'); const modalBody = el('modal-body');
el('modal-close').onclick = ()=> modal.classList.add('hidden');
function showModal(title, html){ modalTitle.textContent = title; modalBody.innerHTML = html; modal.classList.remove('hidden'); }

// Snapshot
el('btn-snap').onclick = ()=>{ const a=document.createElement('a'); a.download=`entropy_edge_v6_turn${turn}.png`; a.href=canvas.toDataURL('image/png'); a.click(); };

// Save/Load
function serialize(){
  return {
    W,H, turn, phase, phaseCounter, frozen, params, owners: Array.from(owners),
    Phi: Array.from(Phi), S: Array.from(S), vx: Array.from(vx), vy: Array.from(vy),
    tech, buildings: buildings.map(b=>({pump:b.pump, mirror:b.mirror, torsion:b.torsion}))
  };
}
function deserialize(data){
  W=data.W; H=data.H; tile=(W>=96?12:(W>=72?14:16)); margin=60;
  alloc();
  turn=data.turn; phase=data.phase; phaseCounter=data.phaseCounter; frozen=data.frozen;
  params = data.params || params;
  owners.set(data.owners);
  Phi.set(data.Phi); S.set(data.S); vx.set(data.vx); vy.set(data.vy);
  tech = data.tech || tech;
  buildings = data.buildings.map(b=>({pump:!!b.pump, mirror:!!b.mirror, torsion:!!b.torsion}));
  el('phaseName').textContent = phase;
}
el('btn-save-file').onclick = ()=>{
  const a = document.createElement('a');
  a.download = `entropy_edge_v6_save.json`;
  a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(serialize()));
  a.click();
};
el('file-load').onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{ const data = JSON.parse(reader.result); deserialize(data); draw(); toast('Loaded save'); };
  reader.readAsText(file);
};
el('btn-save-local').onclick = ()=>{ localStorage.setItem('entropy_edge_v6_save', JSON.stringify(serialize())); toast('Saved to browser'); };
el('btn-load-local').onclick = ()=>{ const s=localStorage.getItem('entropy_edge_v6_save'); if(s){ deserialize(JSON.parse(s)); draw(); toast('Loaded from browser'); } else toast('No quicksave found'); };

// Bind UI
function bindUI(){
  sliders.forEach(k=>{
    const s = el(k), v = el(k+'Val');
    const update = ()=>{ params[k] = parseFloat(s.value); if (v) v.textContent = parseFloat(s.value).toFixed(k==='epsilon'?3:2); };
    s.addEventListener('input', update); update();
  });
  toggles.forEach(id=>{ const t=el(id); t.addEventListener('change', ()=>{ show[id]=t.checked; draw(); }); show[id]=t.checked; });
  el('btn-start').onclick = ()=>{ if(!running){ running=true; loop(); } };
  el('btn-pause').onclick = ()=>{ running=false; };
  el('btn-step').onclick = ()=>{ stepPDE(); draw(); };
  el('btn-reset').onclick = ()=>{ reset(true); draw(); };
  el('btn-rand').onclick = ()=>{ reset(false); draw(); };
  el('btn-toggle-phase').onclick = ()=>{ phase = (phase==='Lamphron')?'Lamphrodyne':'Lamphron'; el('phaseName').textContent = phase; };
  el('btn-inflaton').onclick = inflatonSeed;
  el('btn-diplomacy').onclick = showDiplomacyModal;
  el('btn-tech').onclick = showTechModal;
  el('grid-size').onchange = ()=>{
    const v = el('grid-size').value;
    if (v==='small'){ W=48; H=36; tile=16; margin=50; }
    if (v==='medium'){ W=72; H=54; tile=14; margin=60; }
    if (v==='large'){ W=96; H=72; tile=12; margin=60; }
    reset(true); draw();
  };

  // Build mode
  el('galaxy').addEventListener('click', (ev)=>{
    const rect = canvas.getBoundingClientRect();
    const cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
    let x = Math.floor((cx - margin)/tile), y = Math.floor((cy - margin)/tile);
    if (x<0||x>=W||y<0||y>=H) return;
    const i = idx(x,y);
    const mode = el('build-select').value;
    if (mode==='none') return;
    if (mode==='pump'){ buildings[i].pump = !buildings[i].pump; toast(buildings[i].pump?'Pump placed':'Pump removed'); }
    if (mode==='mirror'){ buildings[i].mirror = !buildings[i].mirror; toast(buildings[i].mirror?'Mirror placed':'Mirror removed'); }
    if (mode==='torsion'){ buildings[i].torsion = !buildings[i].torsion; toast(buildings[i].torsion?'Torsion node placed':'Torsion node removed'); }
    draw();
  });
}

function main(){ bindUI(); reset(true); draw(); }
function loop(){ if(!running) return; stepPDE(); draw(); requestAnimationFrame(loop); }

main();
