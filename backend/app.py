"""
Flask backend for the biogas rate & yield estimator.

Serves the frontend (templates/index.html, static/css, static/js) and
exposes a single JSON API endpoint, POST /api/compute, which runs the
digestion-kinetics model (model.py) server-side and returns the numerical
results used to populate the readouts, charts, and table in the browser.

Run with:
    pip install -r requirements.txt
    python app.py
Then open http://127.0.0.1:5000 in a browser.
"""
import os
import sys

from flask import Flask, jsonify, render_template, request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import analytical_v, euler_integrate, rate, rk4_integrate

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/compute", methods=["POST"])
def compute():
    payload = request.get_json(silent=True) or {}

    try:
        vinf = float(payload.get("vinf"))
        k = float(payload.get("k"))
        t_end = float(payload.get("tEnd"))
        h = float(payload.get("h"))
    except (TypeError, ValueError):
        return jsonify({"error": "All parameters must be numbers."}), 400

    if vinf <= 0 or k <= 0 or t_end <= 0 or h <= 0:
        return jsonify({"error": "All parameters must be positive numbers."}), 400
    if h > t_end:
        return jsonify({"error": "Time step must be smaller than the digestion period."}), 400

    t_steps, v_euler = euler_integrate(vinf, k, t_end, h)
    _, v_rk4 = rk4_integrate(vinf, k, t_end, h)
    v_analytical = [analytical_v(t, vinf, k) for t in t_steps]

    euler_err_pct = [
        abs(ve - va) / va * 100 if va > 0 else 0.0
        for ve, va in zip(v_euler, v_analytical)
    ]
    rk4_err_pct = [
        abs(vr - va) / va * 100 if va > 0 else 0.0
        for vr, va in zip(v_rk4, v_analytical)
    ]

    total_rk4 = v_rk4[-1]
    avg_rate = total_rk4 / t_end
    end_rate = rate(t_end, vinf, k)
    max_rk4_err = max(rk4_err_pct)

    # A denser analytical curve for a smooth reference line on the chart,
    # independent of the (possibly coarse) step size used by Euler/RK4.
    n_dense = 200
    dense_t = [i / n_dense * t_end for i in range(n_dense + 1)]
    dense_analytical = [analytical_v(t, vinf, k) for t in dense_t]

    return jsonify({
        "t": t_steps,
        "analytical": v_analytical,
        "euler": v_euler,
        "eulerErrPct": euler_err_pct,
        "rk4": v_rk4,
        "rk4ErrPct": rk4_err_pct,
        "totalRK4": total_rk4,
        "avgRate": avg_rate,
        "endRate": end_rate,
        "maxRk4Err": max_rk4_err,
        "denseT": dense_t,
        "denseAnalytical": dense_analytical,
    })


if __name__ == "__main__":
    app.run(debug=True)
