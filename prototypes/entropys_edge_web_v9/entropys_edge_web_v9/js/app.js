// Entropy's Edge v9 — Mission Chains + Combat Cards + Victory

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

// Fleets & Loadouts
let fleets = []; // {id,faction,x,y,orders:{x,y}|null,name,mods:Set([...])}
let selectedFleet = null;

// Events, Missions (with chains)
let events = [];         // list of event objects
let missions = [];       // list of mission objects (with chain info)
let eventIdCounter = 1;  // id counter
const eventLogEl = document.getElementById('event-log');

// Scenario & RNG
let rngSeed = 12345;
function seededRandom(){ rngSeed = (1103515245 * rngSeed + 12345) % 2147483647; return rngSeed / 2147483647; }
function setSeed(s){ rngSeed = s >>> 0; }

// Victory
let victory = { equilibriumCounter:0, dominion:0, rebirthArmed:false, achieved:null };

const TOAST = document.getElementById('toast');
function toast(msg){ TOAST.textContent = msg; TOAST.classList.remove('hidden'); setTimeout(()=>TOAST.classList.add('hidden'), 1500); }

function idx(x,y){ x=(x+W)%W; y=(y+H)%H; return y*W+x; }
function alloc(){
  Phi=new Float32Array(W*H); S=new Float32Array(W*H);
  vx=new Float32Array(W*H); vy=new Float32Array(W*H);
  owners=new Uint8Array(W*H);
  buildings=Array.from({length:W*H}, ()=>({pump:false, mirror:false, torsion:false}));
}
function smoothInit(seed=true, archetype='Smooth') {
  if (seed) setSeed(rngSeed);
  const rand = ()=>seededRandom();
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      let p = 0.8, s = 0.4;
      if (archetype==='Smooth'){
        p += 0.5*(0.5 + 0.25*Math.sin(0.15*x+0.10*y)+0.25*Math.sin(0.07*x-0.12*y));
        s += 0.8*(0.5 + 0.25*Math.sin(0.12*x-0.08*y)+0.25*Math.sin(0.06*x+0.09*y));
      } else if (archetype==='Clustered'){
        const cx=W/2, cy=H/2; const d=Math.hypot(x-cx,y-cy);
        p += 0.7*Math.exp(-d*d/(2*(0.18*Math.min(W,H))**2));
        s += 0.5*(rand()-0.5);
      } else if (archetype==='Chaotic'){
        p += 0.6*(rand()-0.5); s += 1.0*(rand()-0.5);
      } else if (archetype==='Baryonic Ring'){
        const cx=W/2, cy=H/2; const d=Math.hypot(x-cx,y-cy);
        const r0 = Math.min(W,H)*0.25;
        p += 0.9*Math.exp(-((d-r0)**2)/(2*(0.08*Math.min(W,H))**2));
        s += 0.6*(rand()-0.5);
      }
      Phi[idx(x,y)] = Math.max(0, Math.min(3, p));
      S[idx(x,y)]   = Math.max(0, Math.min(3, s));
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
  alloc(); if (uniform) smoothInit(true, 'Smooth'); else randomize();
  turn=0; phase='Lamphron'; phaseCounter=0; frozen=false; victory={ equilibriumCounter:0, dominion:0, rebirthArmed:false, achieved:null };
  el('phaseName').textContent = phase;
  el('btn-inflaton').disabled = true;
  fleets=[]; selectedFleet=null; events=[]; missions=[]; eventLogEl.innerHTML='';
  // seed fleets (names)
  const names = ['Alpha','Voyager','Archivum','Catalyst'];
  for (let f=0; f<4; f++) fleets.push({id:f+1,faction:f,x:5+f*3,y:5+f*2,orders:null,name:names[f],mods:new Set()});
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

// ===== Buildings & AI & Ownership (as before) =====
function buildingEffects() {
  for (let i=0;i<W*H;i++){
    if (buildings[i].pump && tech.entropyPump) { const take = 0.03 * S[i]; Phi[i]+=take; S[i]-=take; }
  }
  if (tech.lamphrodyneMirror) {
    const ls = laplace(S);
    for (let i=0;i<W*H;i++){ const factor = buildings[i].mirror ? 0.1 : 0.03; S[i] += factor * ls[i]; }
  }
  if (tech.torsionLandauer) {
    const lvx = laplace(vx), lvy = laplace(vy);
    for (let i=0;i<W*H;i++){ const damp = buildings[i].torsion ? 0.05 : 0.02; vx[i] -= damp * lvx[i]; vy[i] -= damp * lvy[i]; }
  }
}

function aiEmpires() {
  for (let f=0; f<4; f++){
    const target = Math.max(1, Math.floor(W*H*0.05/4));
    let acted = 0, attempts = 0;
    while (acted < target && attempts < W*H){
      attempts++;
      const x = (Math.random()*W)|0, y = (Math.random()*H)|0, i = idx(x,y);
      if ((owners[i]%4)!==f) continue;
      if (f===0) { Phi[i] = Math.min(3, Phi[i] + 0.01); }
      if (f===1) { vx[i] += 0.01*(Math.random()-0.5); vy[i]+=0.01*(Math.random()-0.5); }
      if (f===2) { S[i] = Math.max(0, S[i] - 0.01); }
      if (f===3) { Phi[i] += (Math.random()-0.5)*0.02; S[i]+= (Math.random()-0.5)*0.02; }
      acted++;
    }
  }
}

function ownershipDiffusion() {
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
      if (bestF !== myF && Math.random() < 0.1) owners[i] = bestF;
    }
  }
}

// ===== Fleets & Combat Cards =====
function drawFleets() {
  for (const fl of fleets){
    const cx = margin + fl.x*tile + tile/2;
    const cy = margin + fl.y*tile + tile/2;
    ctx.save(); ctx.translate(cx, cy);
    ctx.rotate(((turn+fl.id)%360) * Math.PI/180);
    ctx.strokeStyle = ['#9bf','#9fb','#fb9','#f9b'][fl.faction%4];
    ctx.fillStyle = selectedFleet && selectedFleet.id===fl.id ? '#fff' : '#000';
    ctx.beginPath();
    ctx.moveTo(0,-6); ctx.lineTo(6,5); ctx.lineTo(-6,5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    if (fl.orders){
      ctx.strokeStyle = '#aaa';
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(margin + fl.orders.x*tile + tile/2, margin + fl.orders.y*tile + tile/2);
      ctx.stroke();
    }
  }
}

function moveFleets() {
  for (const fl of fleets){
    if (!fl.orders) continue;
    const dx = Math.sign(fl.orders.x - fl.x);
    const dy = Math.sign(fl.orders.y - fl.y);
    const speed = (fl.mods && fl.mods.has('Mirror Array') && phase==='Lamphrodyne') ? 2 : 1;
    for (let step=0; step<speed; step++){
      fl.x = (fl.x + dx + W) % W;
      fl.y = (fl.y + dy + H) % H;
      if (fl.x === fl.orders.x && fl.y === fl.orders.y) break;
    }
    if (fl.x === fl.orders.x && fl.y === fl.orders.y) fl.orders = null;
  }
}

const CARD_DECK = [
  {name:'Focus Beam', effect:{M:1.2,E:1.1,F:1.0}},
  {name:'Entropy Diffusion', effect:{M:0.9,E:0.7,F:1.0}},
  {name:'Mirror Burst', effect:{M:1.0,E:1.2,F:1.3}},
  {name:'Torsion Lock', effect:{M:1.1,E:0.8,F:0.9}},
  {name:'Null Maneuver', effect:{M:1.0,E:1.0,F:1.0}},
];

function drawCardsForFleet(fleet){
  // draw 3 random, biased by modules
  const hand = [];
  for (let k=0;k<3;k++){
    let pool = CARD_DECK.slice();
    if (fleet.mods && fleet.mods.has('Torsion Shield')) pool.push({name:'Torsion Lock', effect:{M:1.1,E:0.8,F:0.9}});
    if (fleet.mods && fleet.mods.has('Entropy Lens')) pool.push({name:'Focus Beam', effect:{M:1.2,E:1.1,F:1.0}});
    if (fleet.mods && fleet.mods.has('Mirror Array')) pool.push({name:'Mirror Burst', effect:{M:1.0,E:1.2,F:1.3}});
    hand.push(pool[Math.floor(Math.random()*pool.length)]);
  }
  return hand;
}

function chooseCombatCardModal(fleetA, fleetB, cb){
  const handA = drawCardsForFleet(fleetA);
  const handB = drawCardsForFleet(fleetB);
  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div><h3>Choose for ${fleetA.name} (F${fleetA.faction})</h3>`;
  handA.forEach((c,idx)=>{ html += `<button class="cardA" data-idx="${idx}">${c.name}</button> `; });
  html += `</div><div><h3>AI picks for ${fleetB.name} (F${fleetB.faction})</h3>`;
  handB.forEach((c,idx)=>{ html += `<span class="tag">${c.name}</span> `; });
  html += `</div></div>`;
  showModal('Combat Cards', html);
  for (const b of el('modal-body').querySelectorAll('.cardA')){
    b.onclick = ()=>{
      const idx = parseInt(b.dataset.idx);
      const pickA = handA[idx];
      const pickB = handB[Math.floor(Math.random()*handB.length)];
      modal.classList.add('hidden');
      cb(pickA, pickB);
    };
  }
}

function fleetStatsAt(x,y, fleet){
  const i=idx(x,y);
  let M = Phi[i]*(1 - Math.min(1, S[i]/3));
  let F = Math.sqrt(vx[i]*vx[i] + vy[i]*vy[i]);
  let E = params.lambda * S[i];
  if (fleet && fleet.mods){
    if (fleet.mods.has('Entropy Lens')) M *= 1.15;
    if (fleet.mods.has('Torsion Shield')) E *= 0.85;
    if (fleet.mods.has('Mirror Array') && phase==='Lamphrodyne') F *= 1.2;
  }
  return {M,F,E};
}

function resolveFleetEncounters(cbDone) {
  // group fleets by tile
  const map = new Map();
  for (const fl of fleets){
    const key = fl.x + ',' + fl.y;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(fl);
  }
  const conflicts = [];
  for (const [k, group] of map.entries()){
    if (group.length > 1) conflicts.push(group);
  }
  function processNext(){
    if (!conflicts.length) { cbDone(); return; }
    const group = conflicts.shift();
    const a = group[0], b = group[1];
    // show card picker for A vs B
    chooseCombatCardModal(a,b,(cardA, cardB)=>{
      const {M:Ma,F:Fa,E:Ea} = fleetStatsAt(a.x,a.y,a);
      const {M:Mb,F:Fb,E:Eb} = fleetStatsAt(b.x,b.y,b);
      const Sa = (Ma*cardA.effect.M + 0.5*Fa*cardA.effect.F) - Ea*cardA.effect.E + (a.faction*0.01);
      const Sb = (Mb*cardB.effect.M + 0.5*Fb*cardB.effect.F) - Eb*cardB.effect.E + (b.faction*0.01);
      if (Sa >= Sb) {
        fleets = fleets.filter(f=>f.id!==b.id);
        owners[idx(a.x,a.y)] = a.faction;
        toast(`${a.name} wins (${cardA.name} vs ${cardB.name})`);
      } else {
        fleets = fleets.filter(f=>f.id!==a.id);
        owners[idx(b.x,b.y)] = b.faction;
        toast(`${b.name} wins (${cardB.name} vs ${cardA.name})`);
      }
      // ethics perturbation: winning with Mirror Burst increases torsion (E)
      if (cardA.name==='Mirror Burst' || cardB.name==='Mirror Burst'){
        const ixy = idx(a.x,a.y);
        S[ixy] = Math.min(3, S[ixy] + 0.05);
      }
      processNext();
    });
  }
  processNext();
}

// ===== Events & Mission Chains =====
function randInt(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
function spawnEvent() {
  const rarityRoll = Math.random();
  const rarity = rarityRoll < 0.7 ? 'common' : rarityRoll < 0.95 ? 'rare' : 'legendary';
  const types = ['entropy_anomaly','torsion_storm','ethic_breach'];
  const type = types[randInt(0, types.length-1)];
  const x = randInt(0,W-1), y = randInt(0,H-1);

  const paramsByRarity = { common:{radius:3,amp:0.15}, rare:{radius:5,amp:0.35}, legendary:{radius:7,amp:0.6} }[rarity];
  const id = eventIdCounter++;
  const ev = { id, turn, type, rarity, x, y, r: paramsByRarity.radius, amp: paramsByRarity.amp, state: 'new' };
  events.push(ev);
  renderEventCard(ev);
  applyEventFieldEffect(ev, false);
  if (rarity!=='common' && Math.random() < 0.6) createMissionChainFromEvent(ev);
}

function applyEventFieldEffect(ev, resolved) {
  for (let yy=ev.y-ev.r; yy<=ev.y+ev.r; yy++){
    for (let xx=ev.x-ev.r; xx<=ev.x+ev.r; xx++){
      const i = idx(xx,yy);
      const dx = (xx - ev.x), dy = (yy - ev.y);
      const dist2 = dx*dx + dy*dy;
      if (dist2 > ev.r*ev.r) continue;
      const g = Math.exp(-dist2/(2*(ev.r*ev.r/3)));
      if (ev.type==='entropy_anomaly') {
        const d = ev.amp * g * (resolved ? -1 : +1);
        S[i] = Math.max(0, Math.min(3, S[i] + d));
      } else if (ev.type==='torsion_storm') {
        const d = ev.amp * g * (resolved ? -1 : +1);
        vx[i] += d * (Math.random()-0.5);
        vy[i] += d * (Math.random()-0.5);
      } else if (ev.type==='ethic_breach') {
        const d = ev.amp * g * (resolved ? -1 : +1);
        Phi[i] = Math.max(0, Math.min(3, Phi[i] - d));
      }
    }
  }
}

function renderEventCard(ev) {
  const div = document.createElement('div');
  div.className='event-card';
  div.id = 'ev-'+ev.id;
  const titles = {entropy_anomaly:'Entropy Anomaly', torsion_storm:'Torsion Storm', ethic_breach:'Ethic Breach'};
  const chain = missions.find(m=>m.eventId===ev.id);
  const extras = chain ? ' — <i>Mission Chain</i>' : '';
  div.innerHTML = `
    <div><b>${titles[ev.type]}</b> (${ev.rarity}) at <code>${ev.x},${ev.y}</code> — turn ${ev.turn}${extras}</div>
    <div class="event-actions">
      <button data-act="stabilize">Stabilize</button>
      <button data-act="exploit">Exploit</button>
      <button data-act="dismiss">Dismiss</button>
    </div>
  `;
  eventLogEl.prepend(div);
  for (const b of div.querySelectorAll('button')){
    b.onclick = ()=>{
      if (ev.state!=='new') return;
      const act = b.dataset.act;
      if (act==='stabilize'){ applyEventFieldEffect(ev, true); ev.state='resolved'; toast('Stabilized anomaly'); }
      else if (act==='exploit'){ if (ev.type==='entropy_anomaly'){ applyEventFieldEffect({...ev, type:'ethic_breach'}, true); } if (ev.type==='torsion_storm'){ applyEventFieldEffect(ev, false); } if (ev.type==='ethic_breach'){ applyEventFieldEffect({...ev, type:'entropy_anomaly'}, false); } ev.state='exploited'; toast('Exploited event'); }
      else { ev.state='dismissed'; toast('Event dismissed'); }
      for (const bb of div.querySelectorAll('button')) bb.disabled = true;
    };
  }
}

// Mission Chains
function createMissionChainFromEvent(ev){
  const chain = {
    id: 'mc'+ev.id,
    eventId: ev.id,
    x: ev.x, y: ev.y,
    nodes: [
      {key:'detect', label:'Detect (Pump nearby)', progress:0, done:false},
      {key:'stabilize', label:'Stabilize (Fleet present)', progress:0, done:false},
      {key:'interpret', label:'Interpret (Ethics ≥ 0.2)', progress:0, done:false},
      {key:'branch', label:'Branch: Harmony or Chaos', progress:0, done:false}
    ],
    branch: null, // 'harmony' or 'chaos'
    expires: turn + 60
  };
  missions.push(chain);
  renderMissionChain(chain);
}

function renderMissionChain(m){
  const wrap = document.createElement('div');
  wrap.className='event-card';
  wrap.id = 'mc-'+m.id;
  const nodeRows = m.nodes.map(n=>{
    const pct = n.done ? 100 : Math.floor(n.progress*100);
    return `<div style="margin:6px 0;"><small>${n.label}</small>
      <div class="victory-bar"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
  const branchBtns = (!m.branch && m.nodes[2].done) ? `<button data-b="harmony">Choose Harmony</button> <button data-b="chaos">Choose Chaos</button>` : `<small>Branch: ${m.branch||'—'}</small>`;
  wrap.innerHTML = `<div><b>Mission Chain</b> at <code>${m.x},${m.y}</code> (expires ${m.expires})</div>
    <div id="mc-body-${m.id}">${nodeRows}<div>${branchBtns}</div></div>`;
  eventLogEl.prepend(wrap);
  for (const b of wrap.querySelectorAll('button[data-b]')){
    b.onclick = ()=>{ m.branch = b.dataset.b; toast('Mission branch selected: '+m.branch); };
  }
}

function missionChainTick(){
  const E = ethicsTensor(); const {means} = alignmentMatrix(E);
  const avgEthics = means.reduce((a,b)=>a+b,0)/means.length;

  for (const m of missions){
    if (!m.nodes) continue; // only chains here
    if (turn > m.expires) continue;
    // detect
    if (!m.nodes[0].done){
      let found=false;
      for (let yy=m.y-3; yy<=m.y+3; yy++) for (let xx=m.x-3; xx<=m.x+3; xx++){ const i=idx(xx,yy); if (buildings[i].pump) found=true; }
      if (found) m.nodes[0].progress = Math.min(1, m.nodes[0].progress + 0.05);
      if (m.nodes[0].progress>=1) { m.nodes[0].done=true; toast('Chain: Detect complete'); }
      continue;
    }
    // stabilize
    if (!m.nodes[1].done){
      const here = fleets.some(f=>f.x===m.x && f.y===m.y);
      if (here) m.nodes[1].progress = Math.min(1, m.nodes[1].progress + 0.05);
      if (m.nodes[1].progress>=1) { m.nodes[1].done=true; toast('Chain: Stabilize complete'); }
      continue;
    }
    // interpret
    if (!m.nodes[2].done){
      if (avgEthics >= 0.2) m.nodes[2].progress = Math.min(1, m.nodes[2].progress + 0.04);
      if (m.nodes[2].progress>=1) { m.nodes[2].done=true; toast('Chain: Interpret complete'); }
      continue;
    }
    // branch selection
    if (!m.branch){
      // wait for user choice via UI
    } else if (!m.nodes[3].done){
      m.nodes[3].progress = Math.min(1, m.nodes[3].progress + 0.06);
      if (m.nodes[3].progress>=1){
        m.nodes[3].done=true;
        if (m.branch==='harmony'){
          tech.lamphrodyneMirror = true;
          toast('Harmony chain complete: Lamphrodyne Mirror unlocked');
        } else {
          tech.torsionLandauer = true;
          for (let yy=m.y-3; yy<=m.y+3; yy++) for (let xx=m.x-3; xx<=m.x+3; xx++){ const i=idx(xx,yy); Phi[i] = Math.min(3, Phi[i] + 0.25); }
          toast('Chaos chain complete: Torsion–Landauer unlocked + Φ surge');
        }
      }
    }
    const body = document.getElementById('mc-body-'+m.id);
    if (body){
      const nodeRows = m.nodes.map(n=>{
        const pct = n.done ? 100 : Math.floor(n.progress*100);
        return `<div style="margin:6px 0;"><small>${n.label}</small><div class="victory-bar"><div style="width:${pct}%"></div></div></div>`;
      }).join('');
      const branchBtns = (!m.branch && m.nodes[2].done) ? `<button data-b="harmony">Choose Harmony</button> <button data-b="chaos">Choose Chaos</button>` : `<small>Branch: ${m.branch||'—'}</small>`;
      body.innerHTML = nodeRows + `<div>${branchBtns}</div>`;
      for (const b of body.querySelectorAll('button[data-b]')){ b.onclick = ()=>{ m.branch=b.dataset.b; toast('Mission branch selected: '+m.branch); }; }
    }
  }
}

// periodic events
function periodicEventSpawner() { if (turn>0 && turn % (12 + (turn%8)) === 0) spawnEvent(); }

// ===== Rendering =====
function S_to_color(S) { const s = Math.max(0, Math.min(1, S / 3.0)); const hue = (1 - s) * 240; return `hsl(${hue}, 100%, 55%)`; }
function drawHexCell(cx,cy,size,fill,alpha=1.0){ ctx.beginPath(); for (let i=0;i<6;i++){ const ang=Math.PI/3*i+Math.PI/6; const px=cx+size*Math.cos(ang); const py=cy+size*Math.sin(ang); if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py);} ctx.closePath(); ctx.globalAlpha=alpha; ctx.fillStyle=fill; ctx.fill(); ctx.globalAlpha=1.0; }
function drawMinimap(){ const mini=document.getElementById('minimap'); const mctx=mini.getContext('2d'); const w=mini.width, hgt=mini.height; mctx.clearRect(0,0,w,hgt); for(let y=0;y<H;y++){ for(let x=0;x<W;x++){ const i=idx(x,y); mctx.fillStyle = el('showFactions').checked ? ['#28f','#2f8','#f82','#f2f'][owners[i]%4] : S_to_color(S[i]); const px=Math.floor(x*w/W), py=Math.floor(y*hgt/H); mctx.fillRect(px,py,1,1);} } }

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
      if (buildings[i].pump){ ctx.fillStyle='#8cf'; ctx.fillRect(-3,-3,6,6); }
      if (buildings[i].mirror){ ctx.strokeStyle='#fc8'; ctx.strokeRect(-5,-5,10,10); }
      if (buildings[i].torsion){ ctx.beginPath(); ctx.arc(0,0,5,0,2*Math.PI); ctx.strokeStyle='#c8f'; ctx.stroke(); }
      ctx.restore();
    }
  }
  // events markers
  for (const ev of events){
    const cx = margin + ev.x*tile + tile/2;
    const cy = margin + ev.y*tile + tile/2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(6, ev.r), 0, 2*Math.PI);
    ctx.strokeStyle = ev.state==='new' ? '#f66' : ev.state==='resolved' ? '#6f6' : '#ccf';
    ctx.stroke();
  }
  if (show.showVectors){
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    const step = parseInt(el('arrowStep').value || 3);
    for (let y=0;y<H;y+=step){
      for (let x=0;x<W;x+=step){
        const i=idx(x,y);
        const cx = margin + x*tile + tile/2 + (el('hexMode').checked && (y%2) ? tile*0.3 : 0);
        const cy = margin + y*tile + tile/2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + vx[i]*6.0, cy + vy[i]*6.0); ctx.stroke();
      }
    }
  }
  drawFleets();
  drawMinimap();
  renderVictoryPanel();
  statusEl.textContent = `Turn ${turn} — ${W}x${H} — Phase: ${phase}${frozen?' (Frozen)':''}`;
}

// ===== PDE Loop & Hooks =====
function applyPhaseSchedule() { phaseCounter += 1; const cyc = parseInt(el('cycle').value || params.cycle); if (phaseCounter >= cyc) { phaseCounter = 0; phase = (phase==='Lamphron') ? 'Lamphrodyne' : 'Lamphron'; el('phaseName').textContent = phase; } }

function stepPDE() {
  const lam = parseFloat(el('lamBoost').value || params.lamBoost);
  const dyn = parseFloat(el('dynBoost').value || params.dynBoost);
  const phaseParams = (phase==='Lamphron')
    ? { kPhi: params.kPhi*lam, kS: params.kS, kv: params.kv, lambda: params.lambda/lam, gamma: params.gamma*lam, muS: params.muS*0.8, muV: params.muV, dt: params.dt }
    : { kPhi: params.kPhi, kS: params.kS*dyn, kv: params.kv*dyn, lambda: params.lambda*dyn, gamma: params.gamma, muS: params.muS*1.5, muV: params.muV, dt: params.dt };

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
      S[i]   += localDt * (phaseParams.kS * lapS[i] + params.gamma * gradPhi2 - phaseParams.muS * S[i]);
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

  missionChainTick();
  periodicEventSpawner();

  // Freeze detection for Equilibrium/Rebirth checks
  const [gPx2,gPy2] = grad(Phi); const [gSx2,gSy2] = grad(S);
  let G=0; for (let i=0;i<W*H;i++) G += gPx2[i]*gPx2[i] + gPy2[i]*gPy2[i] + gSx2[i]*gSx2[i] + gSy2[i]*gSy2[i];
  G /= (W*H);
  if (G < params.epsilon){ victory.equilibriumCounter++; } else { victory.equilibriumCounter=0; }
  if (G < params.epsilon && !frozen) { frozen = true; running=false; el('btn-inflaton').disabled = !tech.inflatonSeed; toast('Expyrosis: field frozen'); victory.rebirthArmed = tech.inflatonSeed; }

  // Resolve conflicts with combat cards then continue
  resolveFleetEncounters(()=>{
    moveFleets();
    applyPhaseSchedule();
    turn += 1;
    checkVictory();
  });
}

// ===== Victory =====
function controlPercent(){
  const total=W*H;
  let dominantFaction = 0;
  const counts=[0,0,0,0];
  for (let i=0;i<total;i++) counts[owners[i]%4]++;
  dominantFaction = Math.max(...counts)/total;
  return dominantFaction;
}
function renderVictoryPanel(){
  const vb = el('victory-body');
  const cp = Math.floor(controlPercent()*100);
  const eq = Math.min(100, Math.floor(victory.equilibriumCounter));
  const rb = victory.rebirthArmed? 'Armed' : '—';
  vb.innerHTML = `
    <div>Entropy Equilibrium (G&lt;ε) chain: ${eq} / 100</div>
    <div class="victory-bar"><div style="width:${eq}%"></div></div>
    <div>Dominion: ${cp}% control (goal 70%)</div>
    <div class="victory-bar"><div style="width:${Math.min(100,cp)}%"></div></div>
    <div>Rebirth Cycle: ${rb}</div>
  `;
}

function checkVictory(){
  if (victory.achieved) return;
  const cp = controlPercent();
  if (victory.equilibriumCounter >= 100){
    victory.achieved = 'Entropy Equilibrium';
  } else if (cp >= 0.70){
    victory.achieved = 'Dominion';
  } else if (frozen && victory.rebirthArmed===true){ // user can click Inflaton now to complete
    // if they press inflaton same turn, we mark victory in inflaton handler
  }
  if (victory.achieved){ showVictoryReport(victory.achieved); }
}

function showVictoryReport(kind){
  running=false;
  const total=W*H;
  const counts=[0,0,0,0]; for (let i=0;i<total;i++) counts[owners[i]%4]++;
  const report = `
    <h3>Victory: ${kind}</h3>
    <p>Turns: ${turn}</p>
    <p>Control: F0 ${counts[0]}, F1 ${counts[1]}, F2 ${counts[2]}, F3 ${counts[3]}</p>
    <p>Params: κΦ=${params.kPhi.toFixed(2)}, κS=${params.kS.toFixed(2)}, κᵥ=${params.kv.toFixed(2)}, λ=${params.lambda.toFixed(2)}</p>
    <p>Tip: Use "Save" to export this RSVP Report with your state.</p>
  `;
  showModal('RSVP Report', report);
}

// ===== UI Bits from v8 (Fleet Manager, Scenario, Modals, Save/Load, etc.) =====
function openFleetManager(){
  let html = `<div class="manager-grid">`;
  for (const fl of fleets){
    html += `<div class="manager-card" id="mgr-${fl.id}">
      <h4>Fleet ${fl.id} — F${fl.faction}</h4>
      <label>Name <input data-fid="${fl.id}" class="fleet-name" value="${fl.name}"/></label>
      <div>Mods:</div>
      <select data-fid="${fl.id}" class="mod-select">
        <option>Entropy Lens</option>
        <option>Torsion Shield</option>
        <option>Mirror Array</option>
      </select>
      <button data-fid="${fl.id}" class="btn-add-mod">Add</button>
      <div>Equipped: <span id="mods-${fl.id}">${Array.from(fl.mods).join(', ') || '—'}</span></div>
      <button data-fid="${fl.id}" class="btn-clear-mods">Clear Mods</button>
    </div>`;
  }
  html += `</div>`;
  showModal('Fleet Manager', html);
  for (const inp of el('modal-body').querySelectorAll('.fleet-name')){
    inp.addEventListener('input', ()=>{ const id=parseInt(inp.dataset.fid); const f=fleets.find(ff=>ff.id===id); if(!f)return; f.name=inp.value; });
  }
  for (const btn of el('modal-body').querySelectorAll('.btn-add-mod')){
    btn.onclick = ()=>{ const id=parseInt(btn.dataset.fid); const f=fleets.find(ff=>ff.id===id); if(!f)return; const select=el('modal-body').querySelector(`.mod-select[data-fid="${id}"]`); f.mods.add(select.value); el(`mods-${id}`).textContent=Array.from(f.mods).join(', ')||'—'; };
  }
  for (const btn of el('modal-body').querySelectorAll('.btn-clear-mods')){
    btn.onclick = ()=>{ const id=parseInt(btn.dataset.fid); const f=fleets.find(ff=>ff.id===id); if(!f)return; f.mods.clear(); el(`mods-${id}`).textContent='—'; };
  }
}

function openScenario(){
  const html = `
    <div class="scenario-grid">
      <div class="manager-card"><h4>Seed</h4><input id="sc-seed" value="${rngSeed}" /><button id="sc-set">Set Seed</button></div>
      <div class="manager-card"><h4>Entropy Archetype</h4><select id="sc-arch"><option>Smooth</option><option>Clustered</option><option>Chaotic</option><option>Baryonic Ring</option></select></div>
      <div class="manager-card"><h4>AI Temperament</h4><select id="sc-ai"><option>Neutral</option><option>Aggressive</option><option>Cooperative</option></select></div>
    </div>
    <div style="margin-top:10px;"><button id="sc-generate">Generate Scenario</button><button id="sc-save">Save Scenario JSON</button></div>`;
  showModal('Scenario Generator', html);
  el('sc-set').onclick = ()=>{ const v=parseInt(el('sc-seed').value); if(!isNaN(v)){ rngSeed=v; toast('Seed set'); } };
  el('sc-generate').onclick = ()=>{ const arch=el('sc-arch').value; const ai=el('sc-ai').value; if (ai==='Aggressive'){ params.kv=Math.min(1.5, params.kv+0.1);} if (ai==='Cooperative'){ params.lambda=Math.max(0.0, params.lambda-0.05);} smoothInit(true, arch); draw(); toast(`Scenario: ${arch} / ${ai}`); };
  el('sc-save').onclick = ()=>{ const arch=el('sc-arch').value, ai=el('sc-ai').value; const payload={seed:rngSeed, arch, ai, W,H, owners:Array.from(owners), Phi:Array.from(Phi), S:Array.from(S)}; const a=document.createElement('a'); a.download='entropy_edge_v9_scenario.json'; a.href='data:text/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(payload)); a.click(); };
}

// Modal helpers
const modal = el('modal'); const modalTitle = el('modal-title'); const modalBody = el('modal-body');
el('modal-close').onclick = ()=> modal.classList.add('hidden');
function showModal(title, html){ modalTitle.textContent = title; modalBody.innerHTML = html; modal.classList.remove('hidden'); }

// Snapshot
el('btn-snap').onclick = ()=>{ const a=document.createElement('a'); a.download=`entropy_edge_v9_turn${turn}.png`; a.href=canvas.toDataURL('image/png'); a.click(); };

// Save/Load
function serialize(){
  return {
    W,H, turn, phase, phaseCounter, frozen, params, owners: Array.from(owners),
    Phi: Array.from(Phi), S: Array.from(S), vx: Array.from(vx), vy: Array.from(vy),
    tech, buildings: buildings.map(b=>({pump:b.pump, mirror:b.mirror, torsion:b.torsion})),
    fleets: fleets.map(f=>({id:f.id,faction:f.faction,x:f.x,y:f.y,orders:f.orders,name:f.name,mods:Array.from(f.mods)})),
    events, missions, rngSeed, victory
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
  fleets = (data.fleets || []).map(f=>({ ...f, mods:new Set(f.mods||[]) }));
  events = data.events || []; missions = data.missions || []; rngSeed = data.rngSeed || rngSeed; victory = data.victory || victory;
  eventLogEl.innerHTML=''; for (const ev of events) renderEventCard(ev);
  for (const m of missions){ if (!m.nodes) continue; renderMissionChain(m); }
  el('phaseName').textContent = phase;
  renderVictoryPanel();
}
el('btn-save-file').onclick = ()=>{ const a=document.createElement('a'); a.download=`entropy_edge_v9_save.json`; a.href='data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(serialize())); a.click(); };
el('file-load').onchange = (e)=>{ const file=e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{ const data=JSON.parse(r.result); deserialize(data); draw(); toast('Loaded save'); }; r.readAsText(file); };
el('btn-save-local').onclick = ()=>{ localStorage.setItem('entropy_edge_v9_save', JSON.stringify(serialize())); toast('Saved to browser'); };
el('btn-load-local').onclick = ()=>{ const s=localStorage.getItem('entropy_edge_v9_save'); if(s){ deserialize(JSON.parse(s)); draw(); toast('Loaded from browser'); } else toast('No quicksave found'); };

// Controls & interactions
function buildingModeClick(x,y){
  const i = idx(x,y);
  const mode = el('build-select').value;
  if (mode==='none') return false;
  if (mode==='pump'){ buildings[i].pump = !buildings[i].pump; toast(buildings[i].pump?'Pump placed':'Pump removed'); }
  if (mode==='mirror'){ buildings[i].mirror = !buildings[i].mirror; toast(buildings[i].mirror?'Mirror placed':'Mirror removed'); }
  if (mode==='torsion'){ buildings[i].torsion = !buildings[i].torsion; toast(buildings[i].torsion?'Torsion node placed':'Torsion node removed'); }
  return true;
}

function selectOrOrderFleet(x,y){
  const here = fleets.filter(f=>f.x===x && f.y===y);
  if (here.length){
    selectedFleet = here[0];
    toast(`Fleet ${selectedFleet.name} (F${selectedFleet.faction}) selected`);
  } else if (selectedFleet){
    selectedFleet.orders = {x,y};
    toast(`Order set → ${x},${y}`);
  }
}

function canvasClick(ev){
  const rect = canvas.getBoundingClientRect();
  const cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
  const x = Math.floor((cx - margin)/tile), y = Math.floor((cy - margin)/tile);
  if (x<0||x>=W||y<0||y>=H) return;
  if (!buildingModeClick(x,y)) selectOrOrderFleet(x,y);
  draw();
}

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
  el('btn-inflaton').onclick = ()=>{ if (tech.inflatonSeed) { for (let i=0;i<W*H;i++){ Phi[i]+= (Math.random()-0.5)*0.05; if (Phi[i]<0) Phi[i]=0; if (Phi[i]>3) Phi[i]=3; } frozen=false; running=true; el('btn-inflaton').disabled=true; loop(); if (!victory.achieved && victory.rebirthArmed) { victory.achieved='Rebirth Cycle'; showVictoryReport(victory.achieved); } } };
  el('btn-diplomacy').onclick = showDiplomacyModal;
  el('btn-tech').onclick = showTechModal;
  el('grid-size').onchange = ()=>{
    const v = el('grid-size').value;
    if (v==='small'){ W=48; H=36; tile=16; margin=50; }
    if (v==='medium'){ W=72; H=54; tile=14; margin=60; }
    if (v==='large'){ W=96; H=72; tile=12; margin=60; }
    reset(true); draw();
  };
  canvas.addEventListener('click', canvasClick);
  el('btn-fleet-mgr').onclick = openFleetManager;
  el('btn-scenario').onclick = openScenario;
}

function main(){ bindUI(); reset(true); draw(); }
function loop(){ if(!running) return; stepPDE(); draw(); requestAnimationFrame(loop); }

// Diplomacy & Tech (minimal stubs carried over)
function ethicsTensor() { const [gvx_x, gvx_y] = grad(vx); const [gvy_x, gvy_y] = grad(vy); const [gPx, gPy] = grad(Phi); const E = new Float32Array(W*H); for (let i=0;i<W*H;i++) E[i] = gvx_x[i]*gPx[i] + gvy_y[i]*gPy[i]; return E; }
function alignmentMatrix(E) { const factions=4; const means=new Array(factions).fill(0); const counts=new Array(factions).fill(0); for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const i=idx(x,y); const f=owners[i]%factions; means[f]+=E[i]; counts[f]++; } for (let f=0; f<factions; f++) means[f] = counts[f] ? means[f]/counts[f] : 0; const norm=Math.sqrt(means.reduce((a,b)=>a+b*b,0))||1; const v=means.map(m=>m/norm); const A=Array.from({length:factions},(_,i)=>Array.from({length:factions},(_,j)=>v[i]*v[j])); return {means, A}; }
function showDiplomacyModal() { const E=ethicsTensor(); const {means,A}=alignmentMatrix(E); let html='<h3>Ethics Means per Faction</h3><p>'+means.map(x=>x.toFixed(3)).join(', ')+'</p>'; html+='<h3>Alignment Matrix</h3><table><thead><tr><th></th>'; for(let i=0;i<4;i++) html+=`<th>F${i}</th>`; html+='</tr></thead><tbody>'; for(let i=0;i<4;i++){ html+=`<tr><th>F${i}</th>`; for(let j=0;j<4;j++){ html+=`<td>${A[i][j].toFixed(3)}</td>`; } html+='</tr>'; } html+='</tbody></table>'; showModal('Diplomacy & Ethics', html); }
function showTechModal() { const rows=[['Entropy Pump','Convert local S → Φ each step.','—',tech.entropyPump],['Lamphrodyne Mirror','Diffuse entropy with extra smoothing.','Entropy Pump',tech.lamphrodyneMirror],['Torsion–Landauer Filter','Damp vortical (curl) modes.','Lamphrodyne Mirror',tech.torsionLandauer],['Inflaton Seed','Rebirth after freeze (Expyrosis).','Torsion–Landauer Filter',tech.inflatonSeed],]; let html='<table><thead><tr><th>Tech</th><th>Description</th><th>Prereq</th><th>Status</th></tr></thead><tbody>'; for (const r of rows){ const [name,desc,pre,unlocked]=r; const id=name.replace(/[^a-z]/gi,'').toLowerCase(); html+=`<tr><td>${name}</td><td>${desc}</td><td>${pre}</td><td>`; if (unlocked) html+='Unlocked ✓'; else html+=`<button data-tech="${id}" class="unlock">Unlock</button>`; html+='</td></tr>'; } html+='</tbody></table>'; showModal('Technology', html); for (const b of el('modal-body').querySelectorAll('button.unlock')){ b.onclick=()=>{ const t=b.dataset.tech; if (t==='lamphrodynemirror' && !tech.entropyPump) return alert('Requires Entropy Pump'); if (t==='torsionlandauerfilter' && !tech.lamphrodyneMirror) return alert('Requires Lamphrodyne Mirror'); if (t==='inflatonseed' && !tech.torsionLandauer) return alert('Requires Torsion–Landauer Filter'); if (t==='entropypump') tech.entropyPump = true; if (t==='lamphrodynemirror') tech.lamphrodyneMirror = true; if (t==='torsionlandauerfilter') tech.torsionLandauer = true; if (t==='inflatonseed') tech.inflatonSeed = true; if (t==='inflatonseed') el('btn-inflaton').disabled = !frozen; b.textContent='Unlocked ✓'; b.disabled=true; }; } }

main();
