# Real-Time Transaction Monitoring with Risk Scoring and Community Detection

## Overview

- This extension enhances the real-time business transaction monitoring application by integrating graph-native risk scoring, alert generation, and community detection. The system processes incoming transactions to compute risk scores for businesses, identify anomalous events (alerts), and group businesses into communities based on transaction patterns. These insights are visualized in the interactive graph and updated live via WebSockets, enabling users to monitor financial flows, detect potential risks, and analyze network structures efficiently.
  The implementation focuses on backend logic for computation and data enrichment, with minimal frontend modifications to display the new features. All changes leverage the existing architecture, ensuring seamless integration without disrupting core functionality.
  Features

## Real-Time Transaction Processing: Transactions are analyzed as they occur, updating risk scores, alerts, and community groupings dynamically.

- Risk Scoring: Each business receives a score (0-100) based on transaction volume, degree (number of unique counterparties), and recent alerts. Scores are computed incrementally for efficiency.
- Alert Generation: Rule-based detection for anomalies such as high-value transfers, bursts of activity, first-time links, and self-loops. Alerts are persisted in SQLite and contribute to risk scores.
- Community Detection: Businesses are grouped using weakly connected components via Union-Find, recomputed periodically or after a threshold of new transactions.
- Metrics Dashboard: Aggregated metrics (total transactions, total amount, alert counts by severity) are tracked and displayed in the UI header for quick oversight.
- Visualization Modes: Toggle between:

#### Community Mode: Nodes colored by community ID; edges weighted by transaction count (log-scaled for balanced visualization).

#### Risk Mode: Nodes colored by risk score; edges influenced by adjacent node risk with a transaction volume component.

#### New Transaction Notification: A non-intrusive banner appears briefly on new transactions, maintaining interactivity (e.g., drag/zoom remains enabled).

### Changes and Improvements

### Risk Model (services/riskService.ts)

#### Implementation:

- Risk scores are calculated as a weighted sum: volume (log-scaled outgoing/incoming amounts), degree (normalized unique counterparties), and penalties from recent alerts. Only medium/high-severity alerts impact the rolling count within a configurable window.
  Alert Rules: Includes SELF_LOOP (from == to), HIGH_VALUE (amount >= threshold), BURST (>= min count in window), and FIRST_TIME_LINK (no prior edges between pair). Rules are modular for easy extension.
- Why: Provides an explainable, incremental mechanism to highlight anomalies, integrated directly after transaction creation for real-time response.
- Trade-offs: In-memory state for speed (resets on restart); prioritizes transparency over advanced ML techniques.

### Communities (services/communityService.ts)

#### Implementation:

- Uses Union-Find on aggregated edges to compute weakly connected components. Recomputes every N transactions or X milliseconds (whichever first), updating node community IDs.
- Why: Enables visualization of transaction clusters, revealing business ecosystems without heavy computation.
- Trade-offs: Focuses on efficiency for real-time use; suitable for current scale but could evolve to modularity-based algorithms for finer-grained communities.

### Alerts Storage in SQLite (repositories/alertRepository.ts)

#### Implementation:

- Creates/maintains an alerts table; inserts new alerts with type/severity; supports querying recent alerts (DESC order by timestamp).
- Fix: Quoted reserved keywords (e.g., AS "from", AS "to") in SQL for compatibility.
- Why: Persists anomalies for auditing and metrics, decoupled from Memgraph for metadata separation.
- Trade-offs: SQLite suffices for demo concurrency; for production, migrate to a dedicated RDBMS for better querying/retention.

### Metrics Roll-Up (services/metricsService.ts, services/notificationService.ts)

#### Implementation:

- Maintains in-memory counters for total transactions, amounts, and alert severities; updated on each transaction and included in WebSocket payloads.
- Why: Offers at-a-glance summaries in the UI, enhancing usability without additional endpoints.
- Trade-offs: State resets on restart; lightweight for current needs.

### Transactions API (routes/transactions.ts)

#### Implementation:

- POST endpoint creates edges, evaluates risks (storing alerts), updates communities if threshold met, refreshes metrics, and emits enriched updates.
- Why: Centralizes processing in the transaction lifecycle for consistency.
- Trade-offs: Slight added latency per POST from chained operations, negligible at scale.

### UI Enhancements

The user interface now supports toggling between visualization modes to provide flexible insights into transaction data. In Community mode, nodes are colored by detected clusters, and edges are scaled by transaction frequency for clear relationship mapping. In Risk mode, nodes reflect computed risk levels, with edges adjusted to emphasize connections to high-risk entities. A subtle notification banner indicates new transactions without interrupting interactions like dragging or zooming.
Configuration Options

### The system is tunable via environment variables for flexibility:

Risk Rules:

```
HIGH_VALUE_THRESHOLD=95000: Minimum amount for high-value alert.
BURST_MIN_COUNT=4: Transactions needed in window for burst alert.
ALERTS_WINDOW_MS=300000: Time window (ms) for recent alerts.
ALERTS_PENALTY_DIVISOR=8: Divisor for alert penalty in scoring (higher reduces impact).

Risk Weights:

RISK_WEIGHT_VOLUME=0.2: Weight for transaction volume.
RISK_WEIGHT_DEGREE=0.2: Weight for counterparty degree.
RISK_WEIGHT_ALERTS=0.6: Weight for recent alerts.

Community Recompute:

COMMUNITY_RECOMPUTE_EVERY_N_TX=5: Transactions between full recomputes.
COMMUNITY_RECOMPUTE_INTERVAL_MS=30000: Maximum interval (ms) between recomputes.

Data Stores:

DATABASE_PATH=./database/sayari.db: SQLite path.
MEMGRAPH_URL=bolt://localhost:7687: Memgraph connection.

Adjustments like increasing ALERTS_PENALTY_DIVISOR or reducing RISK_WEIGHT_ALERTS can moderate risk visualizations for balanced demos.
```

## Tests

### Focused tests were added to validate core functionality:

Risk Service: Verifies rule triggering, low-severity exclusion from rolling penalties, and score computation under various weights.
Community Service: Confirms initial computation and recomputes after thresholds (N transactions or interval).
Metrics Service: Ensures counters increment correctly on transactions and alerts.
Transactions Route: Covers happy-path POST, including validation, creation, and update chain.
Alerts Repository: Tests table creation, insertion, and recent query retrieval (with DESC ordering).

### Limitations and Future Work

In-memory state for risks, communities, and metrics resets on restart; persist to Memgraph properties for durability.
SQLite adequate for demo; scale to a relational database for high concurrency and advanced querying.
Community detection uses basic connected components; consider Louvain for modularity in denser graphs.
Edge visualization differentiates modes; further refinements could incorporate user-defined thresholds.

### Demo Script

This extension provides a real-time view of business transactions, with nodes representing businesses and edges indicating financial flows. As transactions occur, the graph updates dynamically to reflect the latest state.
In Community mode, nodes are colored by detected clusters, highlighting interconnected groups, while edges are weighted by transaction count to emphasize frequent interactions. Users can interact with the graph via drag and zoom for detailed exploration.
Switching to Risk mode colors nodes based on a computed risk score, derived from volume, degree, and recent alerts. Edges are influenced by adjacent risk levels, allowing quick identification of potential exposure chains. Header metrics provide aggregated insights, updating in real-time.
The system is configurable via environment variables, enabling fine-tuning of risk thresholds and weights for specific use cases.
