# rsvp_game/kernels_hex.py
import numpy as np

# Axial coords (a,b) with 6 neighbors
NEIGH = np.array([[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]], dtype=int)

def laplace_hex(U, h):
    # U is (H,W) where rows ~ b, cols ~ a (axial)
    s = np.zeros_like(U)
    for da, db in NEIGH:
        s += np.roll(np.roll(U, db, axis=0), da, axis=1)
    return (s - 6*U) / (h*h)

def gradmag_hex(U, h):
    # approximate |grad U|^2 as mean of squared directional differences
    acc = np.zeros_like(U)
    for da, db in NEIGH:
        acc += ((np.roll(np.roll(U, db, axis=0), da, axis=1) - U) / h) ** 2
    return acc / 6.0

def grad_hex(U, h):
    # least-squares gradient estimate in embedded skew coords
    # Embed axial (a,b) to 2D: x = a + 0.5*b, y = (sqrt(3)/2)*b
    # We'll approximate partials by finite differences along neighbor directions and invert
    sqrt3 = np.sqrt(3.0)
    dirs = np.array([
        [1,0],
        [1,-1],
        [0,-1],
        [-1,0],
        [-1,1],
        [0,1]
    ], dtype=float)
    # Convert axial dir to embedded (x,y)
    emb = np.stack([dirs[:,0] + 0.5*dirs[:,1], (sqrt3/2.0)*dirs[:,1]], axis=1)  # shape (6,2)

    # Build (A^T A)^{-1} A^T pre-matrix for LS; do once
    At = emb.T  # 2x6
    inv = np.linalg.pinv(At @ emb) @ At  # (2x2)@(2x6) = 2x6

    gx = np.zeros_like(U)
    gy = np.zeros_like(U)
    for k,(da,db) in enumerate(dirs.astype(int)):
        diff = np.roll(np.roll(U, int(db), axis=0), int(da), axis=1) - U  # directional difference
        if k == 0:
            stack = diff[np.newaxis,...]
        else:
            stack = np.concatenate([stack, diff[np.newaxis,...]], axis=0)
    # stack: (6,H,W). Apply LS per-pixel: [gx,gy]^T = inv @ (stack/h)
    # Compute linear combination
    gx = (inv[0,0]*stack[0] + inv[0,1]*stack[1] + inv[0,2]*stack[2] + inv[0,3]*stack[3] + inv[0,4]*stack[4] + inv[0,5]*stack[5]) / h
    gy = (inv[1,0]*stack[0] + inv[1,1]*stack[1] + inv[1,2]*stack[2] + inv[1,3]*stack[3] + inv[1,4]*stack[4] + inv[1,5]*stack[5]) / h
    return gx, gy

def div_hex(vx, vy, h):
    # divergence via LS gradient of components
    gvxx, gvxy = grad_hex(vx, h)
    gvyx, gvyy = grad_hex(vy, h)
    return gvxx + gvyy
