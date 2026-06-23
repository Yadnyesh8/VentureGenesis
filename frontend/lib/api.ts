// API client for the VENTUREGENESIS backend. Requests are proxied via next.config rewrites.

export type Metrics = {
  startup_name?: string;
  industry?: string;
  business_model?: string;
  stage?: string;
  founding_year?: number;
  revenue?: number;
  expenses?: number;
  burn_rate?: number;
  runway?: number;
  customer_count?: number;
  customer_growth?: number;
  churn_rate?: number;
  funding_amount?: number;
  employee_count?: number;
  valuation?: number;
  status?: string;
};

export type Ref = {
  startup_id?: number | null;
  metrics?: Metrics;
  description?: string;
  revenue_series?: number[];
  scenario?: string;
};

// Call the backend directly (CORS enabled) so long-running agent requests aren't killed
// by the Next.js dev proxy's idle-socket timeout. Falls back to relative (proxy) if unset.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function post<T = any>(path: string, body: any): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  status: () => get("/status"),
  config: () => get("/config"),
  startups: () => get("/startups"),
  createStartup: (m: Metrics) => post("/startups", m),
  uploadCsv: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("upload failed");
    return res.json();
  },
  understand: (ref: Ref) => post("/understand", ref),
  failure: (ref: Ref) => post("/failure", ref),
  forecast: (ref: Ref) => post("/forecast", ref),
  funding: (ref: Ref) => post("/funding", ref),
  health: (ref: Ref) => post("/health", ref),
  competitor: (ref: Ref) => post("/competitor", ref),
  market: (ref: Ref) => post("/market", ref),
  strategy: (ref: Ref) => post("/strategy", ref),
  simulate: (ref: Ref) => post("/simulate", ref),
  pivots: (ref: Ref) => post("/pivots", ref),
  board: (ref: Ref) => post("/board", ref),
  debate: (ref: Ref) => post("/debate", ref),
  // Frontier agents
  voi: (ref: Ref & { allow_fetch?: boolean }) => post("/voi", ref),
  agi: (ref: Ref & { moats?: Record<string, number> }) => post("/agi", ref),
  causal: (ref: Ref) => post("/causal", ref),
  spinout: (req: SpinoutReq) => post("/spinout", req),
};

// Internal R&D project evaluated for corporate spin-out viability.
export type SpinoutProject = {
  project_name?: string;
  parent_industry?: string;
  stage?: string;
  market_disruption?: number;
  cannibalization_risk?: number;
  capital_intensity?: number;
  talent_flight_risk?: number;
  strategic_adjacency?: number;
  annual_budget?: number;
  parent_cost_of_capital?: number;
};
export type SpinoutReq = { project: SpinoutProject; metrics?: Metrics; description?: string };

// Generic SSE consumer for our POST streaming endpoints.
async function streamSSE(path: string, ref: Ref, onEvent: (ev: any) => void) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ref),
  });
  if (!res.body) throw new Error("no stream body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data:")) {
        try {
          onEvent(JSON.parse(line.slice(5).trim()));
        } catch {
          /* ignore malformed */
        }
      }
    }
  }
}

// Stream the debate over SSE.
export function streamDebate(ref: Ref, onEvent: (ev: any) => void) {
  return streamSSE("/debate/stream", ref, onEvent);
}

// Stream the full board pipeline (every agent) over SSE.
export function streamBoard(ref: Ref, onEvent: (ev: any) => void) {
  return streamSSE("/board/stream", ref, onEvent);
}
