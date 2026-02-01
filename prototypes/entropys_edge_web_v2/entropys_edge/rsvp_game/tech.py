# rsvp_game/tech.py
from dataclasses import dataclass, field

TECH_TREE = {
    "Entropy Pump": {"desc":"Convert local S -> Φ each turn.", "prereq": []},
    "Lamphrodyne Mirror": {"desc":"Diffuse S to neighbors after step.", "prereq": ["Entropy Pump"]},
    "Torsion–Landauer Filter": {"desc":"Damp incoherent vorticity.", "prereq": ["Lamphrodyne Mirror"]},
    "Inflaton Seed": {"desc":"Trigger rebirth event at freeze.", "prereq": ["Torsion–Landauer Filter"]},
}

@dataclass
class ResearchState:
    # unlocked tech per faction id -> set
    unlocked: dict = field(default_factory=lambda: {})

    def is_unlocked(self, faction:int, tech:str) -> bool:
        return tech in self.unlocked.get(faction, set())

    def unlock(self, faction:int, tech:str) -> bool:
        if tech not in TECH_TREE:
            return False
        # check prereqs
        prereq = TECH_TREE[tech]["prereq"]
        cur = self.unlocked.get(faction, set())
        if not all(p in cur for p in prereq):
            return False
        cur = set(cur)
        cur.add(tech)
        self.unlocked[faction] = cur
        return True
