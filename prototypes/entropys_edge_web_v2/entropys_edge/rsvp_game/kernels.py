# rsvp_game/kernels.py
import numpy as np

def laplace(U, h):
    return (
        np.roll(U, 1, 0) + np.roll(U, -1, 0) +
        np.roll(U, 1, 1) + np.roll(U, -1, 1) - 4*U
    ) / (h*h)

def grad(U, h):
    gx = (np.roll(U, -1, 1) - np.roll(U, 1, 1)) / (2*h)  # x ~ cols
    gy = (np.roll(U, -1, 0) - np.roll(U, 1, 0)) / (2*h)  # y ~ rows
    return gx, gy

def div(vx, vy, h):
    dvx_dx = (np.roll(vx, -1, 1) - np.roll(vx, 1, 1)) / (2*h)
    dvy_dy = (np.roll(vy, -1, 0) - np.roll(vy, 1, 0)) / (2*h)
    return dvx_dx + dvy_dy

def clamp(U, lo, hi):
    return np.minimum(np.maximum(U, lo), hi)
