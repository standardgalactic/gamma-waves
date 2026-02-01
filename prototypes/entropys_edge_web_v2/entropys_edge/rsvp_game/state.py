# rsvp_game/state.py
from dataclasses import dataclass
import numpy as np

@dataclass
class GameState:
    turn: int
    width: int
    height: int
    Phi: np.ndarray
    S: np.ndarray
    vx: np.ndarray
    vy: np.ndarray
    owners: np.ndarray  # int ids
    buildings: dict     # {(y,x): [str,...]}

    def serialize(self, sample_arrows_step=3):
        # Downsampled arrows for UI
        arrows = []
        for y in range(0, self.height, sample_arrows_step):
            for x in range(0, self.width, sample_arrows_step):
                arrows.append({
                    "x": x, "y": y,
                    "vx": float(self.vx[y, x]),
                    "vy": float(self.vy[y, x]),
                })
        tiles = []
        for y in range(self.height):
            for x in range(self.width):
                tiles.append({
                    "x": x, "y": y,
                    "phi": float(self.Phi[y, x]),
                    "S": float(self.S[y, x]),
                    "owner": int(self.owners[y, x]),
                    "buildings": self.buildings.get((y, x), []),
                })
        return {
            "turn": self.turn,
            "width": self.width, "height": self.height,
            "tiles": tiles,
            "arrows": arrows,
        }
