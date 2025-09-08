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

### Demo Screen Shots
<img width="1725" height="950" alt="Screenshot 2025-09-09 at 1 39 35 AM" src="https://github.com/user-attachments/assets/35af6622-a322-43df-b6f6-c44ccb51c5d5" />
<img width="1725" height="955" alt="Screenshot 2025-09-09 at 1 39 15 AM" src="https://github.com/user-attachments/assets/bd50c4da-6194-4981-885c-2348011e6595" />
<img width="1719" height="1033" alt="Screenshot 2025-09-09 at 1 37 35 AM" src="https://github.com/user-attachments/assets/ada1d104-32ec-4f84-b54a-cf1491dc1bde" />
<img width="1727" height="1035" alt="Screenshot 2025-09-09 at 1 37 20 AM" src="https://github.com/user-attachments/assets/e40bc2de-2116-4dc0-9f14-acb214834cc1" />
