from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math

app = FastAPI()

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CycleInputs(BaseModel):
    mdotAir: float
    T1: float
    P1: float
    rp: float
    etaC: float
    etaT: float
    etaCC: float
    LHV: float
    Cp: float
    gamma: float
    T3: float

T_REF = 298.15
P_REF = 101.325
S_REF = 0.0

def calc_entropy(T: float, P: float, cp: float, R_gas: float) -> float:
    return S_REF + cp * math.log(T / T_REF) - R_gas * math.log(P / P_REF)

@app.post("/api/calculate")
def calculate_cycle(inputs: CycleInputs):
    print("Received inputs:", inputs)
    cp = inputs.Cp
    gamma = inputs.gamma
    cv = cp / gamma
    R_gas = cp - cv

    mdotAir = inputs.mdotAir
    T1 = inputs.T1
    P1 = inputs.P1
    rp = inputs.rp
    etaC = inputs.etaC
    etaT = inputs.etaT
    etaCC = inputs.etaCC
    LHV = inputs.LHV
    T3 = inputs.T3

    # ====== STATE 1: Compressor Inlet (Ambient) ======
    h1 = cp * T1
    s1 = calc_entropy(T1, P1, cp, R_gas)

    # ====== STATE 2: Compressor Outlet ======
    P2 = P1 * rp
    T2s = T1 * math.pow(rp, (gamma - 1) / gamma)
    T2 = T1 + (T2s - T1) / etaC
    h2 = cp * T2
    s2 = calc_entropy(T2, P2, cp, R_gas)

    w_comp = cp * (T2 - T1)
    P_comp = mdotAir * w_comp

    # ====== STATE 3: Combustion Chamber Outlet / Turbine Inlet ======
    P3 = P2
    h3 = cp * T3
    s3 = calc_entropy(T3, P3, cp, R_gas)

    heatSensible = cp * (T3 - T2)
    mdotFuel = (mdotAir * heatSensible) / (LHV * etaCC - heatSensible)
    AF = mdotAir / mdotFuel
    mdotTotal = mdotAir + mdotFuel

    # ====== STATE 4: Turbine Outlet ======
    P4 = P1
    T4s = T3 / math.pow(rp, (gamma - 1) / gamma)
    T4 = T3 - etaT * (T3 - T4s)
    h4 = cp * T4
    s4 = calc_entropy(T4, P4, cp, R_gas)

    w_turb = cp * (T3 - T4)
    P_turb = mdotTotal * w_turb

    w_net = w_turb - w_comp
    P_net = mdotTotal * w_net

    eta_th = (w_net / heatSensible) * 100

    states = [
        {"state": 1, "label": "Compressor Inlet", "P": P1, "T": T1, "h": h1, "s": s1},
        {"state": 2, "label": "Compressor Outlet", "P": P2, "T": T2, "h": h2, "s": s2},
        {"state": 3, "label": "Turbine Inlet", "P": P3, "T": T3, "h": h3, "s": s3},
        {"state": 4, "label": "Turbine Outlet", "P": P4, "T": T4, "h": h4, "s": s4},
    ]

    metrics = {
        "P_comp": P_comp,
        "AF": AF,
        "P_turb": P_turb,
        "P_net": P_net,
        "eta_th": eta_th,
    }

    return {
        "states": states,
        "metrics": metrics,
    }
