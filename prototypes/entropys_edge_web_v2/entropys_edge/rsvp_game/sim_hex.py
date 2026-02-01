# rsvp_game/sim_hex.py
import numpy as np
from .kernels_hex import laplace_hex, gradmag_hex, grad_hex, div_hex
from .params import Params
from .state import GameState

class SimulatorHex:
    def __init__(self, width=30, height=24, seed=0, params: Params | None = None):
        self.rng = np.random.default_rng(seed)
        self.params = params or Params()
        self.state = self._new_state(width, height)
        self.phase = "Lamphron"
        self.phase_length = 20
        self.phase_counter = 0

    def _new_state(self, w, h):
        Phi = self._smooth_noise(h, w, 0.5) + 0.8
        S   = self._smooth_noise(h, w, 0.4) + 0.4
        vx  = self._smooth_noise(h, w, 0.05)
        vy  = self._smooth_noise(h, w, 0.05)
        owners = self.rng.integers(0, 3, size=(h, w), endpoint=True)
        buildings = {}
        return GameState(0, w, h, Phi, S, vx, vy, owners, buildings)

    def _smooth_noise(self, h, w, scale=1.0):
        base = self.rng.normal(0,1,size=(h,w))
        for _ in range(5):
            base = (np.roll(base,1,0)+np.roll(base,-1,0)+np.roll(base,1,1)+np.roll(base,-1,1)+base)/5.0
        base = (base - base.min()) / (base.max()-base.min()+1e-9)
        return scale * base

    def _apply_phase_multipliers(self, p: Params) -> Params:
        from .params import LAM_MULT, DYN_MULT
        p = Params(**vars(p))
        mult = LAM_MULT if self.phase == "Lamphron" else DYN_MULT
        for k,v in mult.items():
            if hasattr(p,k):
                setattr(p,k,getattr(p,k)*v)
        return p

    def step(self):
        st = self.state
        p = self._apply_phase_multipliers(self.params)
        h = p.h; dt = p.dt

        lap_Phi = laplace_hex(st.Phi, h)
        lap_S   = laplace_hex(st.S, h)
        gPx, gPy = grad_hex(st.Phi, h)
        gSx, gSy = grad_hex(st.S, h)

        # approximate curlcurl on hex by -lap v + grad(div v)
        divv = div_hex(st.vx, st.vy, h)
        gdivx, gdivy = grad_hex(divv, h)
        lap_vx = laplace_hex(st.vx, h)
        lap_vy = laplace_hex(st.vy, h)
        ccx, ccy = gdivx - lap_vx, gdivy - lap_vy

        st.Phi = st.Phi + dt * (p.kPhi * lap_Phi - p.lmbd * st.S)
        st.S   = st.S   + dt * (p.kS   * lap_S + p.gamma * (gPx**2 + gPy**2) - p.muS * st.S)
        st.vx  = st.vx  + dt * (p.kv * ccx - gSx - p.muv * st.vx)
        st.vy  = st.vy  + dt * (p.kv * ccy - gSy - p.muv * st.vy)

        # buildings
        for (y,x), blist in list(st.buildings.items()):
            if "Entropy Pump" in blist:
                pump = 0.05
                take = pump * st.S[y,x]
                st.Phi[y,x] += take
                st.S[y,x]   -= take

        # phase toggle
        self.phase_counter += 1
        if self.phase_counter >= self.phase_length:
            self.phase_counter = 0
            self.phase = "Lamphrodyne" if self.phase == "Lamphron" else "Lamphron"

        st.turn += 1

    def add_building(self, x, y, name="Entropy Pump"):
        st = self.state
        st.buildings.setdefault((y, x), [])
        if name not in st.buildings[(y, x)]:
            st.buildings[(y, x)].append(name)

    def snapshot(self):
        return self.state.serialize()
