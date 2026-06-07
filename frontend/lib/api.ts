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
  customer_reviews?: string[];
  revenue_series?: number[];
  scenario?: string;
};

const BASE = "";

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
  customer: (ref: Ref) => post("/customer", ref),
  health: (ref: Ref) => post("/health", ref),
  competitor: (ref: Ref) => post("/competitor", ref),
  market: (ref: Ref) => post("/market", ref),
  strategy: (ref: Ref) => post("/strategy", ref),
  simulate: (ref: Ref) => post("/simulate", ref),
  pivots: (ref: Ref) => post("/pivots", ref),
  board: (ref: Ref) => post("/board", ref),
  debate: (ref: Ref) => post("/debate", ref),
};

// Stream the debate over SSE. Calls onEvent for each parsed event.
export async function streamDebate(ref: Ref, onEvent: (ev: any) => void) {
  const res = await fetch(`${BASE}/api/debate/stream`, {
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
