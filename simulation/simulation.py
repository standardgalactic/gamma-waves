import random
import numpy as np
from itertools import product
import zlib

# =========================
# Constants
# =========================
GRID_SIZE = 10  # NxN cells per planet
NUM_PLANETS_PER_SYSTEM = 3
NUM_SYSTEMS = 3
NUM_AGENTS = 20
TURNS = 50

# =========================
# Helper Functions
# =========================
def compress_ratio(data: bytes) -> float:
    return 1 - len(zlib.compress(data)) / len(data)

def gini(array):
    """Compute Gini coefficient"""
    array = np.array(array)
    if np.amin(array) < 0:
        array -= np.amin(array)
    array = np.sort(array)
    n = len(array)
    cumvals = np.cumsum(array)
    return (n + 1 - 2 * np.sum(cumvals) / cumvals[-1]) / n

# =========================
# Core Classes
# =========================
class Cell:
    def __init__(self):
        self.Phi = random.uniform(0.5,1.0)
        self.v = 0.0
        self.S = 0.1
        self.items = []

class Planet:
    def __init__(self, name):
        self.name = name
        self.grid = [[Cell() for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        self.agents = []
        self.techs = set()
    
    def step_cells(self):
        # Simple entropy propagation and decay
        for i,j in product(range(GRID_SIZE), repeat=2):
            cell = self.grid[i][j]
            # decay Phi
            cell.Phi *= 0.99
            # damp v
            cell.v *= 0.95
            # S noise
            cell.S += random.uniform(0,0.01)
        # Optional: divergence term across neighbors

class StarSystem:
    def __init__(self, name):
        self.name = name
        self.planets = [Planet(f"{name}_Planet_{i}") for i in range(NUM_PLANETS_PER_SYSTEM)]
        self.distance_to = {}  # distances to other systems

class Agent:
    def __init__(self, name, planet, agent_type='Producer'):
        self.name = name
        self.planet = planet
        self.type = agent_type
        self.coherence = random.uniform(0.5,1.0)
        self.currency = 100
        self.recent_items = []

    def choose_action(self):
        # simple random action choice; extend later
        return random.choice(['produce','maintain','trade','invest','explore'])

    def act_produce(self, cell):
        # simulate content
        data = bytes(f"{self.name}-{random.randint(0,1000)}","utf-8")
        C_item = compress_ratio(data)
        delta_S = (1 - C_item) * random.uniform(0.01,0.05)
        cell.S += delta_S
        cell.Phi += 0.01
        cell.v += 0.01
        self.recent_items.append((data,C_item))
    
    def act_maintain(self, cell):
        cell.S = max(0, cell.S - 0.02)
        cell.Phi += 0.01
    
    def act_trade(self):
        # placeholder for interplanetary trade
        pass

    def act_invest(self):
        # placeholder for tech or Phi investment
        pass

    def act_explore(self):
        # placeholder for moving to another planet or system
        pass

    def step(self):
        action = self.choose_action()
        cell = random.choice(random.choice(self.planet.grid))
        if action=='produce':
            self.act_produce(cell)
        elif action=='maintain':
            self.act_maintain(cell)
        elif action=='trade':
            self.act_trade()
        elif action=='invest':
            self.act_invest()
        elif action=='explore':
            self.act_explore()

class Universe:
    def __init__(self):
        self.systems = [StarSystem(f"System_{i}") for i in range(NUM_SYSTEMS)]
        self.agents = []
    
    def populate_agents(self):
        for i in range(NUM_AGENTS):
            sys = random.choice(self.systems)
            planet = random.choice(sys.planets)
            agent_type = random.choice(['Producer','Maintainer','Trader','Researcher'])
            agent = Agent(f"Agent_{i}", planet, agent_type)
            self.agents.append(agent)
            planet.agents.append(agent)
    
    def step(self):
        # Planet updates
        for sys in self.systems:
            for planet in sys.planets:
                planet.step_cells()
        # Agent actions
        for agent in self.agents:
            agent.step()

    def log_metrics(self, turn):
        Phi_vals = []
        S_vals = []
        for sys in self.systems:
            for planet in sys.planets:
                for row in planet.grid:
                    for cell in row:
                        Phi_vals.append(cell.Phi)
                        S_vals.append(cell.S)
        Phi_avg = np.mean(Phi_vals)
        S_total = np.sum(S_vals)
        Gini_val = gini([agent.currency for agent in self.agents])
        print(f"Turn {turn}: Φ_avg={Phi_avg:.3f}, S_total={S_total:.3f}, Gini={Gini_val:.3f}")

# =========================
# Simulation
# =========================
def main():
    uni = Universe()
    uni.populate_agents()
    for t in range(TURNS):
        uni.step()
        uni.log_metrics(t)

if __name__ == "__main__":
    main()

