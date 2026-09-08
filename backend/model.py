"""
Digestion kinetics model.
-------------------------------------------------------------
Governing ODE:          dV/dt = k (Vinf - V),  V(0) = 0
Analytical solution:    V(t)  = Vinf * (1 - exp(-k t))
Production rate:        R(t)  = dV/dt = k * Vinf * exp(-k t)

Two numerical integrators solve the ODE and are compared against the
analytical solution above:
  - euler_integrate: explicit (forward) Euler method
  - rk4_integrate:   classical 4th-order Runge-Kutta method

This is a direct Python port of the model previously implemented in
client-side JavaScript (model.js); the equations and step logic are
identical so results match exactly regardless of which language runs them.
"""
import math


def f(t, V, vinf, k):
    """Right-hand side of the ODE: f(t, V) = k (Vinf - V)."""
    return k * (vinf - V)


def analytical_v(t, vinf, k):
    """Closed-form analytical solution."""
    return vinf * (1 - math.exp(-k * t))


def rate(t, vinf, k):
    """Instantaneous production rate, R(t) = dV/dt, evaluated analytically."""
    return k * vinf * math.exp(-k * t)


def euler_integrate(vinf, k, t_end, h):
    """Explicit Euler integration: V_{n+1} = V_n + h * f(t_n, V_n)."""
    n = round(t_end / h)
    t = [0.0]
    v = [0.0]
    for i in range(n):
        v.append(v[i] + h * f(t[i], v[i], vinf, k))
        t.append(t[i] + h)
    return t, v


def rk4_integrate(vinf, k, t_end, h):
    """Classical 4th-order Runge-Kutta integration."""
    n = round(t_end / h)
    t = [0.0]
    v = [0.0]
    for i in range(n):
        k1 = f(t[i], v[i], vinf, k)
        k2 = f(t[i] + h / 2, v[i] + h * k1 / 2, vinf, k)
        k3 = f(t[i] + h / 2, v[i] + h * k2 / 2, vinf, k)
        k4 = f(t[i] + h, v[i] + h * k3, vinf, k)
        v.append(v[i] + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4))
        t.append(t[i] + h)
    return t, v
