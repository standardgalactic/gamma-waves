# server.py
from flask import Flask, jsonify, request, send_from_directory, render_template
textwrap.dedent('''from rsvp_game.sim import Simulator
from rsvp_game.sim_hex import SimulatorHex
from rsvp_game.params import Params
from rsvp_game.diplomacy import ethics_tensor, alignment_matrix
from rsvp_game.tech import ResearchState, TECH_TREE''')
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

research = ResearchState()

sim = Simulator(width=40, height=30, seed=42, params=Params())

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/new_game", methods=["POST"])
def new_game():
    global sim, research
    data = request.get_json(force=True, silent=True) or {}
    w = int(data.get("width", 40)); h = int(data.get("height", 30)); seed = int(data.get("seed", 42))
    grid = str(data.get("grid", "square")).lower()
    if grid == "hex":
        sim = SimulatorHex(width=w, height=h, seed=seed, params=Params())
    else:
        sim = Simulator(width=w, height=h, seed=seed, params=Params())
    research = ResearchState()
    return jsonify({"ok": True, "state": sim.snapshot(), "grid": grid})

@app.route("/api/diplomacy", methods=["GET"])
def diplomacy():
    st = sim.state
    E = ethics_tensor(st.Phi, st.vx, st.vy, sim.params.h)
    A, means = alignment_matrix(st.owners, E)
    return jsonify({
        "ok": True,
        "factions": int(st.owners.max()) + 1,
        "ethics_means": means.tolist(),
        "alignment": A.tolist()
    })

@app.route("/api/tech_tree", methods=["GET"])
def tech_tree():
    return jsonify(TECH_TREE)

@app.route("/api/unlock", methods=["POST"])
def unlock():
    data = request.get_json(force=True)
    faction = int(data.get("faction", 0))
    tech = data.get("tech")
    ok = research.unlock(faction, tech)
    return jsonify({"ok": ok})
if __name__ == "__main__":
    app.run(debug=True)
