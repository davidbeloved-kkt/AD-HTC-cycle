/*
 * Minimal, dependency-free canvas line-chart renderer.
 * Draws one or more line series (with optional markers and dashed
 * strokes) on a <canvas>, with gridlines and axis tick labels scaled
 * to the data range. No external charting library required.
 */

// Draws `series` (an array of { points: [{x,y}, ...], color, ... }) onto
// `canvas`, sized to fill its parent element's width.
function drawLineChart(canvas, series, opts) {
  opts = opts || {};
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement.clientWidth;
  const cssHeight = canvas.height;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const marginL = 54, marginR = 16, marginT = 14, marginB = 32;
  const plotW = cssWidth - marginL - marginR;
  const plotH = cssHeight - marginT - marginB;

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  let allX = [];
  let allY = [];
  series.forEach(function (s) {
    s.points.forEach(function (p) {
      allX.push(p.x);
      allY.push(p.y);
    });
  });

  let xMin = Math.min.apply(null, allX);
  let xMax = Math.max.apply(null, allX);
  let yMin = opts.yMin !== undefined ? opts.yMin : Math.min.apply(null, allY);
  let yMax = opts.yMax !== undefined ? opts.yMax : Math.max.apply(null, allY);
  if (xMin === xMax) xMax = xMin + 1;
  if (yMin === yMax) yMax = yMin + 1;

  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;
  if (opts.yMinFloorZero && yMin > 0) yMin = 0;

  function X(x) { return marginL + ((x - xMin) / (xMax - xMin)) * plotW; }
  function Y(y) { return marginT + plotH - ((y - yMin) / (yMax - yMin)) * plotH; }

  // Gridlines and axis tick labels.
  ctx.strokeStyle = "rgba(127,163,157,0.18)";
  ctx.fillStyle = "#7FA39D";
  ctx.font = "11px Courier New, monospace";
  ctx.lineWidth = 1;

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const yv = yMin + (i / yTicks) * (yMax - yMin);
    const yy = Y(yv);
    ctx.beginPath();
    ctx.moveTo(marginL, yy);
    ctx.lineTo(marginL + plotW, yy);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(formatTick(yv, opts.yFormat), marginL - 8, yy);
  }

  const xTicks = Math.min(8, Math.max(2, Math.round(plotW / 90)));
  for (let i = 0; i <= xTicks; i++) {
    const xv = xMin + (i / xTicks) * (xMax - xMin);
    const xx = X(xv);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(formatTick(xv, opts.xFormat), xx, marginT + plotH + 8);
  }

  // Optional zero-reference line, useful on error/deviation charts.
  if (opts.zeroLine && yMin < 0 && yMax > 0) {
    ctx.strokeStyle = "rgba(231,240,238,0.35)";
    ctx.beginPath();
    ctx.moveTo(marginL, Y(0));
    ctx.lineTo(marginL + plotW, Y(0));
    ctx.stroke();
  }

  // Draw each series: a stroked line, optionally dashed, optionally
  // with circular markers at each data point.
  series.forEach(function (s) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth || 2;
    if (s.dash) ctx.setLineDash(s.dash);
    else ctx.setLineDash([]);

    ctx.beginPath();
    s.points.forEach(function (p, i) {
      const xx = X(p.x);
      const yy = Y(p.y);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    if (s.markers) {
      ctx.fillStyle = s.color;
      s.points.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), s.markerRadius || 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
}

// Formats an axis tick value with a sensible number of decimal places.
function formatTick(v, fmt) {
  if (fmt === "int") return Math.round(v).toString();
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

// Renders a simple colour-swatch legend into `container` from
// `items` = [{ color, label }, ...].
function renderLegend(container, items) {
  container.innerHTML = "";
  items.forEach(function (it) {
    const div = document.createElement("div");
    div.className = "item";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = it.color;
    const label = document.createElement("span");
    label.textContent = it.label;
    div.appendChild(sw);
    div.appendChild(label);
    container.appendChild(div);
  });
}
