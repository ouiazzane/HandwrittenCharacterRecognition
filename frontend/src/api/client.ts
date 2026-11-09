import type {
  ClassMetric,
  Confusion,
  AllowedType,
  HealthStatus,
  Metrics,
  ModelInfo,
  PredictionResponse,
  WordResponse,
} from "../types";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

function describeDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item: unknown) => {
      if (!item || typeof item !== "object") return "";
      const issue = item as { loc?: unknown; msg?: unknown };
      const message = typeof issue.msg === "string" ? issue.msg : "";
      const location = Array.isArray(issue.loc) ? issue.loc[issue.loc.length - 1] : undefined;
      if (!message) return "";
      return typeof location === "string" || typeof location === "number"
        ? `${location}: ${message}`
        : message;
    }).filter(Boolean);
    return messages.join("; ").slice(0, 200) || undefined;
  }
  if (detail && typeof detail === "object") {
    const objectDetail = detail as { message?: unknown };
    if (typeof objectDetail.message === "string") return objectDetail.message;
    try {
      return JSON.stringify(detail);
    } catch {
      return "Request failed";
    }
  }
  return undefined;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError("Cannot reach the API");
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === "object" && "detail" in body
      ? describeDetail(body.detail)
      : undefined;
    throw new ApiError(detail ?? `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthStatus> {
  return request("/api/health");
}

export function predict(image: string, topK = 3, allowed: AllowedType = "all"): Promise<PredictionResponse> {
  return request("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, top_k: topK, allowed }),
  });
}

export function getModelInfo(): Promise<ModelInfo> {
  return request("/api/model-info");
}

export function getMetrics(): Promise<Metrics> {
  return request("/api/metrics");
}

export function getConfusions(): Promise<Confusion[]> {
  return request("/api/confusions");
}

export function getClassReport(): Promise<ClassMetric[]> {
  return request("/api/class-report");
}

export function predictWord(image: string, allowed: AllowedType = "all"): Promise<WordResponse> {
  return request("/api/predict-word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, allowed }),
  });
}
