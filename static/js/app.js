/*
 * Application wiring.
 * Reads the input parameters from the form, sends them to the Python
 * backend's POST /api/compute endpoint (which runs the digestion-kinetics
 * model: Euler, RK4, and the analytical solution), and renders the
 * results, the two charts, and the step-by-step table using the renderer
 * from chart.js. No numerical computation happens in the browser — this
 * file only handles the request/response and the drawing.
 */

const COLOR_ANALYTICAL = "#E7F0EE";
const COLOR_EULER = "#D9694F";
const COLOR_RK4 = "#6FBF8B";

async function run() {
  const errorMsg = document.getElementById("error-msg");
  errorMsg.style.display = "none";

  const vinf = parseFloat(document.getElementById("in-vinf").value);
  const k = parseFloat(document.getElementById("in-k").value);
  const tEnd = parseFloat(document.getElementById("in-tend").value);
  const h = parseFloat(document.getElementById("in-h").value);

  if (![vinf, k, tEnd, h].every(function (v) { return isFinite(v) && v > 0; })) {
    errorMsg.textContent = "All parameters must be positive numbers.";
    errorMsg.style.display = "block";
    return;
  }
  if (h > tEnd) {
    errorMsg.textContent = "Time step must be smaller than the digestion period.";
    errorMsg.style.display = "block";
    return;
  }

  const runBtn = document.getElementById("run-btn");
  runBtn.disabled = true;
  runBtn.textContent = "Running...";

  let data;
  try {
    const resp = await fetch("/api/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vinf: vinf, k: k, tEnd: tEnd, h: h }),
    });
    data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || "The server returned an error.");
    }
  } catch (err) {
    errorMsg.textContent = "Could not reach the backend: " + err.message;
    errorMsg.style.display = "block";
    return;
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run model";
  }

  document.getElementById("out-total").innerHTML = data.totalRK4.toFixed(3) + ' <span class="sub">m&sup3;</span>';
  document.getElementById("out-avgrate").innerHTML = data.avgRate.toFixed(3) + ' <span class="sub">m&sup3;/day</span>';
  document.getElementById("out-endrate").innerHTML = data.endRate.toFixed(3) + ' <span class="sub">m&sup3;/day</span>';
  document.getElementById("out-rk4err").innerHTML = data.maxRk4Err.toFixed(4) + ' <span class="sub">%</span>';

  // --- Cumulative volume chart: analytical curve + Euler + RK4 ---
  const analyticalDense = data.denseT.map(function (t, i) { return { x: t, y: data.denseAnalytical[i] }; });

  drawLineChart(
    document.getElementById("chart-volume"),
    [
      { points: analyticalDense, color: COLOR_ANALYTICAL, lineWidth: 2 },
      {
        points: data.t.map(function (t, i) { return { x: t, y: data.euler[i] }; }),
        color: COLOR_EULER, lineWidth: 1.5, dash: [5, 3], markers: true, markerRadius: 2.5,
      },
      {
        points: data.t.map(function (t, i) { return { x: t, y: data.rk4[i] }; }),
        color: COLOR_RK4, lineWidth: 1.5, dash: [2, 2], markers: true, markerRadius: 2,
      },
    ],
    { yMinFloorZero: true }
  );

  renderLegend(document.getElementById("legend-volume"), [
    { color: COLOR_ANALYTICAL, label: "Analytical" },
    { color: COLOR_EULER, label: "Euler (h=" + h + " d)" },
    { color: COLOR_RK4, label: "Runge-Kutta 4 (h=" + h + " d)" },
  ]);

  // --- Accuracy chart: relative error of each method vs analytical ---
  drawLineChart(
    document.getElementById("chart-error"),
    [
      {
        points: data.t.slice(1).map(function (t, i) { return { x: t, y: data.eulerErrPct[i + 1] }; }),
        color: COLOR_EULER, lineWidth: 2, markers: true, markerRadius: 2.5,
      },
      {
        points: data.t.slice(1).map(function (t, i) { return { x: t, y: data.rk4ErrPct[i + 1] }; }),
        color: COLOR_RK4, lineWidth: 2, markers: true, markerRadius: 2,
      },
    ],
    { yMinFloorZero: true, zeroLine: true }
  );

  renderLegend(document.getElementById("legend-error"), [
    { color: COLOR_EULER, label: "Euler error (%)" },
    { color: COLOR_RK4, label: "Runge-Kutta 4 error (%)" },
  ]);

  // --- Step-by-step data table ---
  const tbody = document.getElementById("data-table-body");
  tbody.innerHTML = "";
  const stride = Math.max(1, Math.round(data.t.length / 26));
  for (let i = 0; i < data.t.length; i += stride) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + data.t[i].toFixed(2) + "</td>" +
      "<td>" + data.analytical[i].toFixed(4) + "</td>" +
      "<td>" + data.euler[i].toFixed(4) + "</td>" +
      "<td>" + data.eulerErrPct[i].toFixed(3) + "</td>" +
      "<td>" + data.rk4[i].toFixed(4) + "</td>" +
      "<td>" + data.rk4ErrPct[i].toFixed(4) + "</td>";
    tbody.appendChild(tr);
  }
}

document.getElementById("run-btn").addEventListener("click", run);
window.addEventListener("resize", function () {
  // Redraw the charts at the new width. This re-fetches from the backend
  // rather than only resizing, which is a little wasteful but keeps the
  // logic simple; the backend call is fast enough not to matter.
  run();
});

run(); // initial run with the default parameters
