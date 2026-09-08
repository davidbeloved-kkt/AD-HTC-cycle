# Biogas Rate & Yield Estimator — Python Backend + Web Frontend

A tool that estimates cumulative biogas volume and production rate from a
first-order digestion-kinetics model. The numerical model (explicit Euler
and 4th-order Runge–Kutta, checked against the closed-form analytical
solution) now runs **server-side in Python**; the browser only collects
input parameters, calls the backend, and draws the results.

## Architecture

```
Browser (static/js/app.js)
   │  fetch POST /api/compute  { vinf, k, tEnd, h }
   ▼
Flask backend (backend/app.py)
   │  runs backend/model.py (Euler, RK4, analytical solution)
   ▼
JSON response  { t, analytical, euler, rk4, errors, totals, ... }
   │
   ▼
Browser draws charts/table (static/js/chart.js)
```

## Folder structure

```
biogas_fullstack/
├── backend/
│   ├── app.py            # Flask app: serves the frontend + /api/compute
│   ├── model.py            # the numerical model (Python): f, analytical_v,
│   │                        # rate, euler_integrate, rk4_integrate
│   └── requirements.txt
├── templates/
│   └── index.html          # page structure (Jinja template, rendered by Flask)
├── static/
│   ├── css/
│   │   └── style.css        # all visual styling
│   └── js/
│       ├── chart.js          # dependency-free canvas line-chart renderer
│       └── app.js             # reads the input form, calls the backend API,
│                               # and updates the readouts / charts / table
└── README.md
```

## Running it

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in a browser.

The Flask development server serves both the page and the API — there is
nothing separate to start on the frontend side.

## The model

Governing ODE (first-order digestion kinetics):

```
dV/dt = k (V_inf − V),   V(0) = 0
```

Analytical solution:

```
V(t) = V_inf · (1 − e^(−k t))
```

Instantaneous production rate:

```
R(t) = dV/dt = k · V_inf · e^(−k t)
```

`backend/model.py` implements two numerical integrators for the ODE and
compares them against the analytical solution above:

- **Explicit Euler** — `V_{n+1} = V_n + h·f(t_n, V_n)`
- **Classical 4th-order Runge–Kutta** — the standard 4-stage RK4 update

## API

### `POST /api/compute`

Request body:

```json
{ "vinf": 27, "k": 0.0921, "tEnd": 25, "h": 1 }
```

Response body (200 OK):

```json
{
  "t": [0, 1, 2, ...],
  "analytical": [...],
  "euler": [...],
  "eulerErrPct": [...],
  "rk4": [...],
  "rk4ErrPct": [...],
  "totalRK4": 24.2998,
  "avgRate": 0.972,
  "endRate": 0.249,
  "maxRk4Err": 0.0001,
  "denseT": [...],
  "denseAnalytical": [...]
}
```

Validation errors (missing/non-numeric/non-positive parameters, or a time
step larger than the digestion period) return `400` with
`{ "error": "<message>" }`.

## Inputs

| Field | Meaning | Default |
|---|---|---|
| V∞ (m³) | Ultimate biogas potential | 27 |
| k (day⁻¹) | Kinetic rate constant | 0.0921 |
| Digestion period (days) | Simulation horizon | 25 |
| Time step h (days) | Step size for Euler/RK4 | 1 |

The defaults reproduce the reference case used to validate the model; try
increasing the time step (e.g. to 2 or 5 days) and re-running to see the
Euler method's error grow visibly while RK4 stays accurate — that's what
the "Model accuracy" chart is showing.

## Outputs

- Total quantity produced over the digestion period (RK4 estimate)
- Average production rate over the period
- Instantaneous production rate at the end of the period (analytical)
- Maximum numerical error of RK4 vs. the analytical solution
- Cumulative-volume chart: analytical curve vs. Euler vs. RK4
- Accuracy chart: % relative error of each numerical method vs. time
- A step-by-step table of every computed value

## Extending it

- To add another numerical method (e.g. a trapezoidal-quadrature estimate
  of cumulative volume from the rate function), add the function to
  `backend/model.py`, include its output in the `/api/compute` response,
  and add a new series to the charts in `static/js/app.js`.
- All colors, spacing, and typography are defined as CSS custom properties
  at the top of `static/css/style.css`.
- For a production deployment, run the Flask app behind a proper WSGI
  server (e.g. `gunicorn backend.app:app`) instead of the built-in
  development server used by `python app.py`.
