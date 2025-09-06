# Business Name Enrichment in Transaction Details Table

## Overview

- This feature addresses the need to display human-readable business names in the "From" and "To" columns of the Transaction Details table, replacing cryptic IDs for better usability. Transactions are fetched from Memgraph (storing IDs, amounts, and timestamps), while names are retrieved from SQLite via the existing /api/businesses endpoint. A custom React hook (useBusinessDirectory) loads the directory via HTTP once and keeps it updated via WebSocket payloads, enabling efficient lookups in the frontend.

## The implementation enriches transaction data in the backend without altering existing ID-based contracts, adding optional fromName and toName fields. Frontend changes are minimal, focusing on displaying names while supporting search by both IDs and names.

## Features

- Name Display in Table: Each transaction row shows business names in "From" and "To" columns, with fallback to IDs if names are unavailable.
  Search by Name or ID: The search bar matches against both business names and IDs for flexible querying.
- Efficient Directory Management: Initial HTTP fetch of businesses, with opportunistic updates from WebSocket node data to keep the lookup fresh without additional requests.
- Performance Limits: Caps stored transactions at 250 rows to maintain UI responsiveness and memory efficiency.
- Collapsible Panel: Users can collapse/expand the table for better screen real estate management.

## Changes and Improvements

### Jest Configuration (jest.config.js)

#### Implementation:

- Added a Jest config using ts-jest for ESM support, with jsdom environment, test matching for .test.ts(x), and setup files for extended assertions. Configured module mappers for CSS and tsconfig overrides for modern ES features.
- Why: Enables reliable testing of React components and hooks, ensuring compatibility with TypeScript and Vite.
- Trade-offs: Focused on core setup; additional plugins (e.g., for coverage) can be added later.

### TypeScript Configuration (tsconfig.json)

#### Implementation:

- Extended compiler options with JSX support (react-jsx), module resolution (nodenext), and types for Jest/testing-library. Included esModuleInterop for smoother imports.
- Why: Aligns with modern React/Vite setup, enabling type-safe testing without compilation errors.
- Trade-offs: Keeps config lean; could include stricter linting rules for production.

### Business Directory Hook (hooks/useBusinessDirectory.ts)

#### Implementation:

- A React hook that fetches businesses via /api/businesses on mount (with abort handling), builds an ID-to-name map, and updates it from WebSocket payloads (initialData and graphUpdate). Provides a lookup(id) function for O(1) name resolution.
- Why: Centralizes name resolution, reducing redundant fetches and ensuring data freshness across components.
- Trade-offs: In-memory map is efficient for small datasets; for larger directories, could integrate caching libraries like LRU-cache.

### Transaction Details Component (components/TransactionDetails/TransactionDetails.tsx)

#### Implementation:

- Uses the directory hook for name lookups when rendering. Maintains existing search/filter logic (matches IDs, timestamps, and amounts), sortable columns, row limits (250 max), and highlight clearing on unmount.
- Why: Delivers the core feature (name display) while keeping contracts stable and avoiding extra backend calls.
- Trade-offs: Relies on frontend mapping for names; falls back to IDs if the directory is not yet loaded.

### Tests

- Focused tests were added to validate core functionality:

- Business Directory Hook: Verifies initial fetch populates the map, WebSocket updates enrich records, lookup falls back to ID on misses, and abort handling prevents stale updates.
  Transaction Details Component: Covers rendering with names, sorting across columns, row limiting, highlight timeouts, and search behavior aligned with ID/timestamp/amount fields.

### Limitations and Future Work

- Directory state is component-scoped; for app-wide sharing, could use context or state management (e.g., Redux).
- Assumes small business count; scale to pagination or lazy loading for larger datasets.
- No dedicated error UI for fetch failures; add retries or alerts for production.
- Search is client-side and currently matches IDs/timestamps/amounts; extend to search by names if needed.

### Demo Script

This feature replaces business IDs with names in the Transaction Details table, making it easier to identify entities at a glance. On load, the table fetches transactions and displays names via a directory hook that merges SQLite metadata with Memgraph data in the browser.
Search the table by ID, timestamp, or amount—results update instantly. The panel can be collapsed for focus on the graph, and new transactions highlight briefly. The implementation ensures no disruption to ID-based logic, with fallbacks for robustness.
