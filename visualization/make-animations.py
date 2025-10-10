#!/usr/bin/python3

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import zlib
import random
import pandas as pd
from typing import List, Dict

class Cell:
    def __init__(self, phi: float, v: float, s: float):
        self.phi = phi
        self.v = v
        self.s = s

class Agent:
    def __init__(self, agent_id: int, cell_idx: tuple, agent_type: str):
        self.agent_id = agent_id
        self.cell_idx = cell_idx
        self.agent_type = agent_type  # 'producer', 'maintainer', 'corporate'
        self.wealth = 100.0
        self.reputation = 0.0
        self.recent_items = []  # list of (C_item, exposure)
        self.displacement_exported = 0.0
        self.restorative_jobs_created = 0.0
        self.dependency_externality = 0.0  # Simplified

    def choose_action(self) -> str:
        if self.agent_type == 'producer':
            return random.choices(['produce', 'maintain'], weights=[0.8, 0.2])[0]
        elif self.agent_type == 'maintainer':
            return random.choices(['produce', 'maintain'], weights=[0.2, 0.8])[0]
        elif self.agent_type == 'corporate':
            return random.choices(['produce', 'automate', 'maintain'], weights=[0.6, 0.3, 0.1])[0]
        return 'produce'

    def update_reputation(self, delta: float):
        self.reputation += delta

class World:
    def __init__(self, grid_size: int = 20, num_agents: int = 100, alpha: float = 0.1, beta: float = 0.1, gamma: float = 0.1,
                 alpha_create: float = 0.05, alpha_decay: float = 0.01, alpha_restore: float = 0.03,
                 beta_production: float = 0.02, beta_damp: float = 0.01, kappa_div: float = 0.05):
        self.grid_size = grid_size
        self.grid = [[Cell(random.uniform(0.5, 1.0), 0.0, 0.1) for _ in range(grid_size)] for _ in range(grid_size)]
        self.agents = self._init_agents(num_agents)
        self.alpha = alpha  # robot tax rate
        self.beta = beta  # noise tax rate
        self.gamma = gamma  # merit dividend rate
        self.alpha_create = alpha_create
        self.alpha_decay = alpha_decay
        self.alpha_restore = alpha_restore
        self.beta_production = beta_production
        self.beta_damp = beta_damp
        self.kappa_div = kappa_div
        self.metrics = {'t': [], 'H': [], 'S_total': [], 'Phi_avg': [], 'Gini': []}

    def _init_agents(self, num_agents: int) -> List[Agent]:
        agents = []
        types = ['producer'] * (num_agents // 3) + ['maintainer'] * (num_agents // 3) + ['corporate'] * (num_agents - 2 * (num_agents // 3))
        random.shuffle(types)
        for i in range(num_agents):
            x, y = random.randint(0, self.grid_size - 1), random.randint(0, self.grid_size - 1)
            agents.append(Agent(i, (x, y), types[i]))
        return agents

    def get_neighbors(self, x: int, y: int) -> List[tuple]:
        neighbors = []
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < self.grid_size and 0 <= ny < self.grid_size:
                neighbors.append((nx, ny))
        return neighbors

    def run_step(self, t: int):
        # Agents act
        for agent in self.agents:
            x, y = agent.cell_idx
            cell = self.grid[x][y]
            action = agent.choose_action()
            if action == 'produce':
                item = self._generate_item()
                exposure = random.uniform(1.0, 10.0)
                comp_ratio = len(zlib.compress(item)) / len(item)
                C_item = 1 - comp_ratio
                delta_S = (1 - C_item) * exposure * 0.1  # Scaled production entropy
                cell.s += delta_S
                cell.v += random.uniform(0.1, 0.5) * self.beta_production
                cell.phi += random.uniform(0.1, 0.3) * self.alpha_create
                agent.recent_items.append((C_item, exposure))
                if len(agent.recent_items) > 5:  # Sliding window
                    agent.recent_items.pop(0)
                agent.wealth += exposure * 0.5  # Payoff
                agent.update_reputation(C_item * 0.1)
            elif action == 'maintain':
                delta_absorb = random.uniform(0.5, 2.0)
                cell.s = max(0, cell.s - delta_absorb)
                cell.phi += random.uniform(0.2, 0.5) * self.alpha_restore
                agent.restorative_jobs_created += random.uniform(0.1, 0.3)
                agent.wealth += 1.0  # Small payoff
                agent.update_reputation(1.0)
            elif action == 'automate':
                D_increase = random.uniform(0.5, 2.0)
                agent.displacement_exported += D_increase
                cell.v += random.uniform(0.3, 0.7)
                agent.wealth += D_increase * 2.0  # Profit
                agent.update_reputation(-0.5)

            # Simplified dependency externality
            agent.dependency_externality = random.uniform(0.0, 1.0) if random.random() < 0.1 else agent.dependency_externality

        # Apply divergence term
        div_grid = np.zeros((self.grid_size, self.grid_size))
        for x in range(self.grid_size):
            for y in range(self.grid_size):
                cell = self.grid[x][y]
                div = 0.0
                for nx, ny in self.get_neighbors(x, y):
                    n_cell = self.grid[nx][ny]
                    div += (n_cell.phi * n_cell.v - cell.phi * cell.v)
                div_grid[x][y] = div * self.kappa_div
        for x in range(self.grid_size):
            for y in range(self.grid_size):
                self.grid[x][y].s -= div_grid[x][y]  # Reabsorption
                self.grid[x][y].s = max(0, self.grid[x][y].s)

        # Compute taxes and merit dividends
        merit_fund = 0.0
        for agent in self.agents:
            tau_robot = self.alpha * max(0, agent.displacement_exported - agent.restorative_jobs_created)
            tau_noise = self.beta * sum((1 - C) * exp for C, exp in agent.recent_items)
            merit_fund += tau_robot + tau_noise
            agent.wealth -= tau_robot + tau_noise

        # Distribute merit fund based on dependency externality
        total_E = sum(max(0, a.dependency_externality) for a in self.agents)
        if total_E > 0:
            for agent in self.agents:
                payout = (merit_fund * max(0, agent.dependency_externality) / total_E) if total_E > 0 else 0
                agent.wealth += payout

        # Update decays and noise
        for x in range(self.grid_size):
            for y in range(self.grid_size):
                cell = self.grid[x][y]
                cell.phi = max(0, cell.phi - self.alpha_decay * cell.phi)
                cell.v *= (1 - self.beta_damp)
                cell.s = max(0, cell.s + random.uniform(0.0, 0.05))  # Noise

        # Log metrics
        self._log_metrics(t)

    def _generate_item(self) -> bytes:
        # Generate random "content" bytes for compression test
        length = random.randint(100, 1000)
        return bytes(random.getrandbits(8) for _ in range(length))

    def _log_metrics(self, t: int):
        S_total = sum(cell.s for row in self.grid for cell in row)
        Phi_avg = np.mean([cell.phi for row in self.grid for cell in row])
        # Simplified H: 0.5 * v^2 + 1/Phi + S^2
        H = sum(0.5 * cell.v**2 + 1/(cell.phi + 1e-6) + cell.s**2 for row in self.grid for cell in row)
        wealths = [a.wealth for a in self.agents if a.wealth > 0]
        gini = 0.0 if len(wealths) < 2 else 2 * np.mean(wealths) / np.sum(np.abs(np.subtract.outer(wealths, wealths))) - 1
        self.metrics['t'].append(t)
        self.metrics['H'].append(H)
        self.metrics['S_total'].append(S_total)
        self.metrics['Phi_avg'].append(Phi_avg)
        self.metrics['Gini'].append(gini)

    def run_simulation(self, T: int = 200):
        for t in range(T):
            self.run_step(t)
        df = pd.DataFrame(self.metrics)
        df.to_csv('simulation_metrics.csv', index=False)

    def plot_metrics(self):
        df = pd.DataFrame(self.metrics)
        fig, axs = plt.subplots(2, 2, figsize=(12, 8))
        # Convert Pandas Series to NumPy arrays for plotting
        axs[0, 0].plot(df['t'].to_numpy(), df['H'].to_numpy())
        axs[0, 0].set_title('Hamiltonian Proxy H(t)')
        axs[0, 0].set_xlabel('Time')
        axs[0, 0].set_ylabel('H')

        axs[0, 1].plot(df['t'].to_numpy(), df['S_total'].to_numpy())
        axs[0, 1].set_title('Total Entropy S_total(t)')
        axs[0, 1].set_xlabel('Time')
        axs[0, 1].set_ylabel('S_total')

        axs[1, 0].plot(df['t'].to_numpy(), df['Phi_avg'].to_numpy())
        axs[1, 0].set_title('Average Capacity Φ_avg(t)')
        axs[1, 0].set_xlabel('Time')
        axs[1, 0].set_ylabel('Φ_avg')

        axs[1, 1].plot(df['t'].to_numpy(), df['Gini'].to_numpy())
        axs[1, 1].set_title('Wealth Gini Coefficient')
        axs[1, 1].set_xlabel('Time')
        axs[1, 1].set_ylabel('Gini')

        plt.tight_layout()
        plt.savefig('metrics_plot.png')
        plt.close()

    def animate_grid(self, field: str = 's', filename: str = 'entropy_animation.mp4'):
        fig, ax = plt.subplots()
        data = np.array([[getattr(self.grid[x][y], field) for y in range(self.grid_size)] for x in range(self.grid_size)])

        # Since we don't have per-step grids saved, simulate animation with final state for demo; extend to save states in production
        # For full animation, modify run_step to save grid snapshots
        def update(frame):
            # Mock update: add noise for demo
            mock_data = data + np.random.uniform(-0.1, 0.1, data.shape)
            im.set_array(mock_data)
            return [im]

        im = ax.imshow(data, cmap='viridis', animated=True)
        ani = animation.FuncAnimation(fig, update, frames=50, interval=200, blit=True)
        ani.save(filename, writer='ffmpeg')
        plt.close()

if __name__ == '__main__':
    world = World()
    world.run_simulation(T=200)
    world.plot_metrics()
    world.animate_grid(field='s', filename='entropy_animation.mp4')
    world.animate_grid(field='phi', filename='capacity_animation.mp4')
    world.animate_grid(field='v', filename='activity_animation.mp4')
    print("Simulation completed. Metrics saved to 'simulation_metrics.csv'. Plots in 'metrics_plot.png'. Animations in *.mp4 files.")
