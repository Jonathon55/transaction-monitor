## Demo Scenarios

### 1) High-Value Alerts and Risk Coloring

- Start all services: `docker compose up -d --build`
- Open the app, set color mode to **Risk** (toggle in header).
- Run the simulator (it sends up to 50 tx).
- Watch for **yellow snackbar** when a **HIGH_VALUE** alert triggers.
- Observe nodes with high risk turning **orange/red**.

### 2) Community Coloring

- Switch color mode to **Community**.
- You should see 2–3 distinct color clusters (based on the simulator’s two groups).
- The clusters recompute periodically (every 5 tx or 30s).

### 3) Burst Scenario (optional)

- In `transaction_simulator/index.js`, set `const interval = 400` to stress the system.
- In `transaction_simulator/simulator.js`, temporarily set `MAX_TRANSACTIONS = 100`.
- You should see **BURST** alerts and rapid risk score increases (node turns red).

### 4) Self-Loop (optional)

- Manually POST a transaction where `from === to`.
- Observe a **SELF_LOOP** alert and a warning log in backend.
