# CSV Sales Aggregator

A full-stack tool that takes raw CSV sales data, aggregates total sales by department, and presents the results with charts, metrics, and a downloadable output. Built with a **Next.js** frontend and an **Express + TypeScript** backend that processes files off the main thread using Node.js Worker Threads.

---

## Project Structure

```
CSV parser/
├── backend/          # Express API server (TypeScript)
│   ├── src/
│   │   ├── index.ts              # API routes & server entry point
│   │   ├── jobStore.ts           # In-memory job registry with disk persistence
│   │   ├── workers/
│   │   │   └── csvProcessor.ts   # Worker thread — parses & aggregates CSV
│   │   └── tests/
│   │       └── csvProcessor.test.ts
│   └── package.json
│
└── frontend/         # Next.js 16 / React 19 app (TypeScript)
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx          # Main page — ties everything together
    │   │   └── layout.tsx        # App shell, theme provider
    │   └── components/
    │       ├── Uploader.tsx      # Drag-and-drop CSV upload + editable table
    │       ├── AnalysisView.tsx  # Charts, metrics, and download
    │       └── HistorySidebar.tsx# Past jobs sidebar
    └── package.json
```

---

## How to Run the App

You need two terminals — one for the backend and one for the frontend.

### 1. Backend

```bash
cd "CSV parser/backend"
npm install
npm run dev
```

The API server starts at **http://localhost:4000**.

### 2. Frontend

```bash
cd "CSV parser/frontend"
npm install
npm run dev
```

The web app opens at **http://localhost:3000**.

> Both servers must be running at the same time. The frontend talks to the backend at port 4000 — no extra configuration needed for local development.

---

## How to Test

Tests live in the backend and are written with **Jest** + **Supertest**. They run the real Worker Thread against a temporary CSV file so you are testing the actual processing logic, not a mock.

```bash
cd "CSV parser/backend"
npm test
```

The test suite:
- Creates a temporary CSV with known data (two departments, one invalid row)
- Spawns the `csvProcessor` worker thread against it
- Asserts that `Electronics` totals to **250** (100 + 150), `Clothing` to **200**
- Confirms the invalid row (`Nothing` as the sales figure) is silently skipped
- Cleans up the temp files after the run

---

## Algorithm Explanation & Memory Efficiency

### The Core Problem

The input can be an arbitrarily large CSV file. A naive approach — loading the entire file into memory as a JavaScript array — would run out of memory on large datasets.

### The Streaming Aggregation Approach

Instead of reading everything at once, the processor uses a **read stream** piped through a CSV parser:

```
File on disk
    │
    ▼
fs.createReadStream()     ← reads in small chunks, never loads the full file
    │
    ▼
csv-parser (pipe)         ← converts each chunk into row objects, one at a time
    │
    ▼
accumulator object        ← a plain { [department]: { total, date } } map
    │
    ▼
fs.createWriteStream()    ← writes aggregate results without buffering output
```

Only **one row lives in memory at a time** during parsing. As each row arrives, its `sales` value is added to the running total for that department in the accumulator. Once the stream ends, the small summary object (one entry per unique department, not per row) is written out.

### Department Normalization

Before accumulating, department names are title-cased and whitespace-collapsed:

```
"electronics " → "Electronics"
"CLOTHING"     → "Clothing"
"men  clothing"→ "Men Clothing"
```

This prevents the same department appearing twice under different capitalizations.

### Off-Main-Thread Processing

Parsing happens inside a **Node.js Worker Thread**, not the Express event loop. This means:
- Large files don't block the API from handling other requests
- Progress updates (every 5% of bytes read) are posted back to the main thread via `parentPort.postMessage`
- The frontend receives live progress through a **Server-Sent Events** (SSE) endpoint — no polling, no WebSocket overhead

---

## Big O Complexity

Let **N** = number of rows in the CSV, **D** = number of unique departments.

| Step | Time Complexity | Space Complexity |
|---|---|---|
| Stream parsing (read + parse all rows) | O(N) | O(1) — one row at a time |
| Accumulation into the department map | O(N) | O(D) — one entry per unique dept |
| Writing output CSV / JSON | O(D) | O(D) |
| **Total** | **O(N)** | **O(D)** |

In practice **D ≪ N** (e.g., 15 departments across millions of rows), so the memory footprint stays essentially constant regardless of file size. The bottleneck is always I/O, not computation.

---

## API Reference (Quick Overview)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/upload` | Upload a CSV file — returns a `jobId` |
| `POST` | `/api/upload/json` | Submit data from the editable table |
| `GET` | `/api/status/:id` | SSE stream — live progress updates |
| `GET` | `/api/analysis/:id` | Fetch aggregated results for a job |
| `GET` | `/api/download/:id` | Download the aggregated CSV |
| `DELETE` | `/api/analysis/:id` | Remove a job and its output files |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Charts | Recharts |
| Backend | Express 5, TypeScript, ts-node |
| Processing | Node.js Worker Threads |
| File handling | Multer, csv-parser |
| Testing | Jest, ts-jest, Supertest |
| Export | xlsx, html2pdf.js |
