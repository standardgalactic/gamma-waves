# rsvp_game/diplomacy.py
import numpy as np

def ethics_tensor(Phi, vx, vy, h):
    # E_i ~ grad v · grad Phi (trace-like)
    # Use central diffs via np.roll (periodic)
    def grad(U):
        gx = (np.roll(U, -1, 1) - np.roll(U, 1, 1)) / (2*h)
        gy = (np.roll(U, -1, 0) - np.roll(U, 1, 0)) / (2*h)
        return gx, gy
    gPx, gPy = grad(Phi)
    gvx_x, gvx_y = grad(vx)
    gvy_x, gvy_y = grad(vy)
    # contraction: sum_d d v^d * d Phi
    E = gvx_x * gPx + gvy_y * gPy
    return E

def alignment_matrix(owners, E, num_factions=None):
    if num_factions is None:
        num_factions = int(owners.max()) + 1
    means = []
    for f in range(num_factions):
        mask = (owners == f)
        if mask.any():
            means.append(E[mask].mean())
        else:
            means.append(0.0)
    means = np.array(means)
    # cosine over 1D vectors reduces to normalized dot product; here keep simple outer
    # Create symmetric alignment by product normalized
    denom = np.linalg.norm(means) + 1e-9
    if denom == 0: 
        denom = 1.0
    v = means / denom
    A = np.outer(v, v)
    return A, means
