# Entropy's Edge — RSVP Prototype (Flask + HTML/JS)

## Quickstart
```bash
cd entropys_edge
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py
```
Open http://127.0.0.1:5000 in your browser.

## Controls
- **Next Turn**: advance 1 step.
- **+10 Turns**: advance 10 steps.
- **New Game**: re-seed the fields.
- **Click on map**: place an *Entropy Pump* building at the clicked tile.

## Notes
- Periodic boundaries via numpy roll.
- Lamphron / Lamphrodyne phases auto-toggle every 20 turns.
- Fields: color = entropy S (blue→red), brightness = capacity Φ, arrows = vector flow 𝒗 (downsampled).
