import sys
import time
from pynput import keyboard

# -----------------------------
# TROPE ENGINE CORE
# -----------------------------
trope_state = {
    "genre": "neutral",
    "archetype": None,
    "meta": None,
    "plot": None,
    "tone": "plain"
}

# Sample narrative base text
base_text = "A lone traveler enters the city at dusk."

def apply_trope(category, value):
    trope_state[category] = value
    print(f"\n[{category.upper()}] → {value.capitalize()}")
    update_story()

def update_story():
    """Generate a simple story variant based on current trope state."""
    g = trope_state["genre"]
    a = trope_state["archetype"]
    m = trope_state["meta"]
    p = trope_state["plot"]
    t = trope_state["tone"]

    story = base_text

    # Genre modifications
    if g == "horror":
        story = story.replace("dusk", "a blood-red twilight")
    elif g == "sci-fi":
        story = story.replace("city", "orbital colony")
    elif g == "romance":
        story = story + " In the crowd, two strangers meet eyes."

    # Archetype modifications
    if a == "hero":
        story = "The destined hero walks alone. " + story
    elif a == "villain":
        story = "The villain smiles beneath the neon glow. " + story

    # Meta modifications
    if m == "fourth_wall":
        story += " You, the watcher, already know how this ends."
    elif m == "aware":
        story += " The story seems aware it is being told."

    # Plot modifications
    if p == "macguffin":
        story += " Everyone hunts for a lost artifact said to change fate."

    # Tone modifications
    if t == "noir":
        story = story.lower() + " the rain never stops."
    elif t == "dreamlike":
        story += " Everything feels slightly unreal."

    print("\n--- Narrative Output ---")
    print(story)
    print("------------------------")

# -----------------------------
# KEYMAP DEFINITIONS
# -----------------------------
key_sequence = []
MAX_DEPTH = 4

def handle_sequence(seq):
    s = "".join(seq)
    if s == " tg h":
        apply_trope("genre", "horror")
    elif s == " tg s":
        apply_trope("genre", "sci-fi")
    elif s == " tg r":
        apply_trope("genre", "romance")
    elif s == " ta h":
        apply_trope("archetype", "hero")
    elif s == " ta v":
        apply_trope("archetype", "villain")
    elif s == " tx b":
        apply_trope("meta", "fourth_wall")
    elif s == " tx a":
        apply_trope("meta", "aware")
    elif s == " tp m":
        apply_trope("plot", "macguffin")
    elif s == " tm n":
        apply_trope("tone", "noir")
    elif s == " tm d":
        apply_trope("tone", "dreamlike")
    elif s == " tr":
        reset_state()
    else:
        pass  # Unknown sequence

def reset_state():
    global trope_state
    trope_state = {k: None for k in trope_state}
    trope_state["genre"] = "neutral"
    trope_state["tone"] = "plain"
    print("\n[RESET] → Narrative returned to base state.")
    update_story()

def on_press(key):
    global key_sequence
    try:
        k = key.char
        key_sequence.append(k)
        if len(key_sequence) > MAX_DEPTH:
            key_sequence.pop(0)
        handle_sequence(key_sequence)
    except AttributeError:
        # Space key is treated as leader key
        if key == keyboard.Key.space:
            key_sequence.append(" ")
        elif key == keyboard.Key.esc:
            print("\nExiting Trope Engine.")
            sys.exit(0)

def on_release(key):
    pass

# -----------------------------
# MAIN LOOP
# -----------------------------
if __name__ == "__main__":
    print("Trope Hotkey Engine — Demo Mode")
    print("Press SPACE then keystrokes (e.g., t g h for horror genre)")
    print("Press ESC to quit.\n")
    update_story()

    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        listener.join()
