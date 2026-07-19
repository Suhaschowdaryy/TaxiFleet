import { getSimulationState, runSimulation, resetSimulationState } from "../lib/simulation-service";

function parseJsonBody(req: any): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    if (req.method !== "POST") {
      resolve({});
      return;
    }

    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url ?? `https://${req.headers.host ?? "localhost"}${req.url}`);

  if (req.method === "GET" && url.pathname.endsWith("/state")) {
    sendJson(res, 200, getSimulationState());
    return;
  }

  if (req.method === "POST" && url.pathname.endsWith("/reset")) {
    sendJson(res, 200, resetSimulationState());
    return;
  }

  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    const steps = Number(body?.steps ?? 1);
    sendJson(res, 200, runSimulation(steps));
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
