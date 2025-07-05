import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import argparse
import os

def simulate_gamma_wave(frequency=40, amplitude=1.0, noise=0.1, duration=0.2, sample_rate=2000):
    """
    Simulates a gamma wave signal.

    Parameters:
        frequency (float): Frequency of the gamma wave in Hz.
        amplitude (float): Amplitude of the signal.
        noise (float): Standard deviation of added Gaussian noise.
        duration (float): Duration of the signal in seconds.
        sample_rate (int): Samples per second.

    Returns:
        t (np.ndarray): Time vector.
        signal (np.ndarray): Simulated gamma wave signal.
    """
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    pure = amplitude * np.sin(2 * np.pi * frequency * t)
    noisy = pure + np.random.normal(0, noise, size=t.shape)
    return t, noisy

def make_gamma_gif(
    frequency=40, amplitude=1.0, noise=0.1, duration=0.2,
    sample_rate=2000, gif_filename="gamma_wave.gif"
):
    """
    Generates and saves an animated GIF showing the gamma wave oscillating.
    """
    t, _ = simulate_gamma_wave(frequency, amplitude, noise, duration, sample_rate)
    nframes = 30
    phase_steps = np.linspace(0, 2 * np.pi, nframes, endpoint=False)

    fig, ax = plt.subplots(figsize=(8, 3))
    plt.close(fig)

    def animate(i):
        ax.clear()
        phase = phase_steps[i]
        pure = amplitude * np.sin(2 * np.pi * frequency * t + phase)
        noisy = pure + np.random.normal(0, noise, size=t.shape)
        ax.plot(t * 1000, noisy, color="#00b2ff", lw=2)
        ax.set_xlim(0, duration * 1000)
        ax.set_ylim(-amplitude-2*noise, amplitude+2*noise)
        ax.set_title(f"Simulated Gamma Wave ({frequency} Hz), Phase {i+1}/{nframes}")
        ax.set_xlabel("Time (ms)")
        ax.set_ylabel("Amplitude")
        ax.grid(True, alpha=0.2)
        ax.set_facecolor("#111317")
        fig.patch.set_facecolor("#181c1f")

    ani = animation.FuncAnimation(
        fig, animate, frames=nframes, interval=80, repeat=True, blit=False
    )

    ani.save(gif_filename, writer="pillow", fps=15)
    return gif_filename

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulate a gamma wave signal, plot it, and export a GIF artifact.")
    parser.add_argument("--frequency", type=float, default=40, help="Gamma wave frequency in Hz (30-150)")
    parser.add_argument("--amplitude", type=float, default=1.0, help="Amplitude of the gamma wave")
    parser.add_argument("--noise", type=float, default=0.1, help="Noise standard deviation")
    parser.add_argument("--duration", type=float, default=0.2, help="Duration in seconds")
    parser.add_argument("--sample_rate", type=int, default=2000, help="Sample rate in Hz")
    parser.add_argument("--gif", type=str, default="gamma_wave.gif", help="Filename for the output animated GIF")
    parser.add_argument("--nogui", action="store_true", help="Do not open a plot window (headless mode)")

    args = parser.parse_args()

    # Simulate and plot static signal
    t, signal = simulate_gamma_wave(
        frequency=args.frequency,
        amplitude=args.amplitude,
        noise=args.noise,
        duration=args.duration,
        sample_rate=args.sample_rate
    )

    plt.figure(figsize=(10, 4))
    plt.plot(t * 1000, signal, color="#00b2ff", lw=2)
    plt.title(f"Simulated Gamma Wave ({args.frequency} Hz)")
    plt.xlabel("Time (ms)")
    plt.ylabel("Amplitude")
    plt.grid(True, alpha=0.2)
    plt.tight_layout()

    static_img = args.gif.replace(".gif", ".png")
    plt.savefig(static_img)
    if not args.nogui:
        plt.show()
    plt.close()

    # Create animated GIF
    print(f"Generating animated gamma wave GIF: {args.gif} ...")
    gif_path = make_gamma_gif(
        frequency=args.frequency,
        amplitude=args.amplitude,
        noise=args.noise,
        duration=args.duration,
        sample_rate=args.sample_rate,
        gif_filename=args.gif
    )
    print(f"Done! Artifact saved as: {gif_path}")
    print(f"Static image also saved as: {static_img}")

    if not os.path.exists(gif_path):
        print("Warning: GIF artifact was not created.")
