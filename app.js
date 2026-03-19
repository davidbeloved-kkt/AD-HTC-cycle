/* ========================================
   AD-HTC Fuel-Enhanced Gas Power Cycle
   Thermodynamic Analysis Engine
   ======================================== */

// --- Constants ---
// Reference state for entropy calculation
const T_REF = 298.15;             // Reference temperature (K)
const P_REF = 101.325;            // Reference pressure (kPa)
const S_REF = 0;                  // Reference entropy (kJ/kg·K)

// --- Chart instances ---
let hsChart = null;
let tsChart = null;

// --- DOM References ---
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');

// --- Event Listeners ---
analyzeBtn.addEventListener('click', runAnalysis);

// Add enter key support
document.querySelectorAll('.input-field').forEach(input => {
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter') runAnalysis();
  });
});

// --- Main Analysis Function ---
function runAnalysis() {
  // Clear previous errors
  clearErrors();

  // Read inputs
  const inputs = readInputs();
  if (!inputs) return;

  // Add loading state
  analyzeBtn.classList.add('loading');
  analyzeBtn.textContent = 'Analyzing...';

  // Simulate slight delay for UX
  setTimeout(() => {
    try {
      const results = calculateCycle(inputs);
      displayResults(results);
      renderCharts(results);
      resultsSection.classList.add('visible');

      // Scroll to results
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Calculation error:', err);
      alert('Calculation error: ' + err.message);
    } finally {
      analyzeBtn.classList.remove('loading');
      analyzeBtn.textContent = '⚡ Analyze System';
    }
  }, 400);
}

// --- Input Reading & Validation ---
function readInputs() {
  const fields = {
    mdotAir: { id: 'inputMdotAir', min: 0.1, max: 1000, name: 'Mass Flow Rate' },
    T1: { id: 'inputT1', min: 200, max: 500, name: 'Ambient Temperature' },
    P1: { id: 'inputP1', min: 50, max: 500, name: 'Ambient Pressure' },
    rp: { id: 'inputRP', min: 1.5, max: 40, name: 'Pressure Ratio' },
    etaC: { id: 'inputEtaC', min: 0.5, max: 1.0, name: 'Compressor Efficiency' },
    etaT: { id: 'inputEtaT', min: 0.5, max: 1.0, name: 'Turbine Efficiency' },
    etaCC: { id: 'inputEtaCC', min: 0.5, max: 1.0, name: 'Combustion Efficiency' },
    LHV: { id: 'inputLHV', min: 5000, max: 60000, name: 'LHV' },
    Cp: { id: 'inputCp', min: 0.5, max: 2.5, name: 'Specific Heat' },
    gamma: { id: 'inputGamma', min: 1.1, max: 1.7, name: 'Specific Heat Ratio' },
    T3: { id: 'inputT3', min: 800, max: 2500, name: 'Turbine Inlet Temp' },
  };

  const values = {};
  let valid = true;

  for (const [key, cfg] of Object.entries(fields)) {
    const el = document.getElementById(cfg.id);
    const val = parseFloat(el.value);

    if (isNaN(val) || val < cfg.min || val > cfg.max) {
      el.classList.add('input-error');
      const errEl = el.parentElement.querySelector('.error-message');
      if (errEl) {
        errEl.textContent = `Must be between ${cfg.min} and ${cfg.max}`;
        errEl.classList.add('visible');
      }
      valid = false;
    } else {
      values[key] = val;
    }
  }

  return valid ? values : null;
}

function clearErrors() {
  document.querySelectorAll('.input-field').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.error-message').forEach(el => el.classList.remove('visible'));
}

// --- Thermodynamic Calculations ---
function calculateCycle({ mdotAir, T1, P1, rp, etaC, etaT, etaCC, LHV, Cp, gamma, T3 }) {
  // Gas properties dynamically parsed from inputs
  const cp = Cp;
  const cv = cp / gamma;
  const R_gas = cp - cv;

  // ====== STATE 1: Compressor Inlet (Ambient) ======
  const h1 = cp * T1;
  const s1 = calcEntropy(T1, P1, cp, R_gas);

  // ====== STATE 2: Compressor Outlet ======
  const P2 = P1 * rp;

  // Isentropic compressor outlet temperature
  const T2s = T1 * Math.pow(rp, (gamma - 1) / gamma);

  // Actual compressor outlet temperature (accounting for inefficiency)
  const T2 = T1 + (T2s - T1) / etaC;
  const h2 = cp * T2;
  const s2 = calcEntropy(T2, P2, cp, R_gas);

  // Specific compressor work (kJ/kg)
  const w_comp = cp * (T2 - T1);
  const P_comp = mdotAir * w_comp;

  // ====== STATE 3: Combustion Chamber Outlet / Turbine Inlet ======
  const P3 = P2;  // Constant-pressure combustion

  // User directly inputs T3 for turbine inlet
  const h3 = cp * T3;
  const s3 = calcEntropy(T3, P3, cp, R_gas);

  // Recalculate exact fuel mass flow rate based on energy balance
  const heatSensible = cp * (T3 - T2);
  const mdotFuel = (mdotAir * heatSensible) / (LHV * etaCC - heatSensible);
  const AF = mdotAir / mdotFuel;
  const mdotTotal = mdotAir + mdotFuel;

  // ====== STATE 4: Turbine Outlet ======
  const P4 = P1;  // Exhaust to ambient

  // Isentropic turbine outlet temperature
  const T4s = T3 / Math.pow(rp, (gamma - 1) / gamma);

  // Actual turbine outlet temperature accounting for inefficiency
  const T4 = T3 - etaT * (T3 - T4s);
  const h4 = cp * T4;
  const s4 = calcEntropy(T4, P4, cp, R_gas);

  // Specific turbine work (kJ/kg) and Power (kW)
  const w_turb = cp * (T3 - T4);
  const P_turb = mdotTotal * w_turb;

  // Net Specific Work and Output Power calculation
  const w_net = w_turb - w_comp;
  const P_net = mdotTotal * w_net;

  // Thermal efficiency
  const eta_th = (w_net / heatSensible) * 100;

  // Build state points array
  const states = [
    { state: 1, label: 'Compressor Inlet', P: P1, T: T1, h: h1, s: s1 },
    { state: 2, label: 'Compressor Outlet', P: P2, T: T2, h: h2, s: s2 },
    { state: 3, label: 'Turbine Inlet', P: P3, T: T3, h: h3, s: s3 },
    { state: 4, label: 'Turbine Outlet', P: P4, T: T4, h: h4, s: s4 },
  ];

  return {
    states,
    metrics: {
      P_comp,
      AF,
      P_turb,
      P_net,
      eta_th,
    },
  };
}

// --- Entropy Calculation ---
// s - s_ref = CP * ln(T/T_ref) - R * ln(P/P_ref)
function calcEntropy(T, P, cp, R_gas) {
  return S_REF + cp * Math.log(T / T_REF) - R_gas * Math.log(P / P_REF);
}

// --- Display Results ---
function displayResults({ states, metrics }) {
  // Metrics
  document.getElementById('metricPcomp').textContent = metrics.P_comp.toFixed(2);
  document.getElementById('metricAF').textContent = metrics.AF.toFixed(2);
  document.getElementById('metricPturb').textContent = metrics.P_turb.toFixed(2);
  document.getElementById('metricPnet').textContent = metrics.P_net.toFixed(2);
  document.getElementById('metricEta').textContent = metrics.eta_th.toFixed(2);

  // State table
  const tbody = document.getElementById('stateTableBody');
  tbody.innerHTML = '';

  states.forEach(st => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <span class="state-label">
          <span class="state-dot state-dot--${st.state}"></span>
          State ${st.state}
        </span>
      </td>
      <td>${st.P.toFixed(2)}</td>
      <td>${st.T.toFixed(2)}</td>
      <td>${st.h.toFixed(2)}</td>
      <td>${st.s.toFixed(4)}</td>
    `;
    tbody.appendChild(row);
  });
}

// --- Chart Rendering ---
function renderCharts({ states }) {
  const stateColors = ['#3b82f6', '#a78bfa', '#fbbf24', '#fb7185'];
  const stateLabels = states.map(s => `State ${s.state}`);
  const sValues = states.map(s => s.s);
  const hValues = states.map(s => s.h);
  const tValues = states.map(s => s.T);

  // Add closing point for cycle visualization
  const sLoop = [...sValues, sValues[0]];
  const hLoop = [...hValues, hValues[0]];
  const tLoop = [...tValues, tValues[0]];

  const chartFont = {
    family: "'JetBrains Mono', monospace",
    size: 11,
  };

  const gridColor = 'rgba(255, 255, 255, 0.06)';
  const tickColor = '#64748b';

  // --- H-S Diagram ---
  const hsCtx = document.getElementById('chartHS').getContext('2d');
  if (hsChart) hsChart.destroy();

  hsChart = new Chart(hsCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Cycle Path',
          data: sLoop.map((s, i) => ({ x: s, y: hLoop[i] })),
          showLine: true,
          borderColor: 'rgba(34, 211, 238, 0.6)',
          borderWidth: 2,
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
        {
          label: 'State Points',
          data: sValues.map((s, i) => ({ x: s, y: hValues[i] })),
          showLine: false,
          pointRadius: 8,
          pointHoverRadius: 11,
          pointBackgroundColor: stateColors,
          pointBorderColor: stateColors.map(c => c + '80'),
          pointBorderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 26, 0.95)',
          borderColor: 'rgba(34, 211, 238, 0.3)',
          borderWidth: 1,
          titleFont: chartFont,
          bodyFont: chartFont,
          padding: 12,
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              return idx < states.length ? `State ${states[idx].state}: ${states[idx].label}` : '';
            },
            label: (item) => [
              `Entropy: ${item.parsed.x.toFixed(4)} kJ/(kg·K)`,
              `Enthalpy: ${item.parsed.y.toFixed(2)} kJ/kg`,
            ],
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Entropy s [kJ/(kg·K)]', color: '#94a3b8', font: chartFont },
          grid: { color: gridColor },
          ticks: { color: tickColor, font: chartFont },
        },
        y: {
          title: { display: true, text: 'Enthalpy h [kJ/kg]', color: '#94a3b8', font: chartFont },
          grid: { color: gridColor },
          ticks: { color: tickColor, font: chartFont },
        },
      },
    },
  });

  // --- T-S Diagram ---
  const tsCtx = document.getElementById('chartTS').getContext('2d');
  if (tsChart) tsChart.destroy();

  tsChart = new Chart(tsCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Cycle Path',
          data: sLoop.map((s, i) => ({ x: s, y: tLoop[i] })),
          showLine: true,
          borderColor: 'rgba(45, 212, 191, 0.6)',
          borderWidth: 2,
          fill: {
            target: 'origin',
            above: 'rgba(45, 212, 191, 0.05)',
          },
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
        {
          label: 'State Points',
          data: sValues.map((s, i) => ({ x: s, y: tValues[i] })),
          showLine: false,
          pointRadius: 8,
          pointHoverRadius: 11,
          pointBackgroundColor: stateColors,
          pointBorderColor: stateColors.map(c => c + '80'),
          pointBorderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 26, 0.95)',
          borderColor: 'rgba(45, 212, 191, 0.3)',
          borderWidth: 1,
          titleFont: chartFont,
          bodyFont: chartFont,
          padding: 12,
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              return idx < states.length ? `State ${states[idx].state}: ${states[idx].label}` : '';
            },
            label: (item) => [
              `Entropy: ${item.parsed.x.toFixed(4)} kJ/(kg·K)`,
              `Temperature: ${item.parsed.y.toFixed(2)} K`,
            ],
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Entropy s [kJ/(kg·K)]', color: '#94a3b8', font: chartFont },
          grid: { color: gridColor },
          ticks: { color: tickColor, font: chartFont },
        },
        y: {
          title: { display: true, text: 'Temperature T [K]', color: '#94a3b8', font: chartFont },
          grid: { color: gridColor },
          ticks: { color: tickColor, font: chartFont },
        },
      },
    },
  });
}
