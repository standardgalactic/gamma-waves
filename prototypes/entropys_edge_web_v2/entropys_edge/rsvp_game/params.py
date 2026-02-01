# rsvp_game/params.py

from dataclasses import dataclass

@dataclass
class Params:
    h: float = 1.0
    dt: float = 0.15
    kPhi: float = 0.8
    kS: float = 0.6
    kv: float = 0.4
    lmbd: float = 0.2
    gamma: float = 0.3
    muS: float = 0.05
    muv: float = 0.08
    Phi_max: float = 3.0
    S_max: float = 3.0

# Meta-phase multipliers
LAM_MULT = {
    "kPhi": 1.25,
    "gamma": 1.25,
    "muS": 0.8,
    "lmbd": 0.8
}

DYN_MULT = {
    "kS": 1.25,
    "kv": 1.25,
    "lmbd": 1.25,
    "muS": 1.5
}
