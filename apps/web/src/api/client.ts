// Typed API client. generated.ts (openapi-typescript) lands in T06.

export interface Health {
  status: "ok";
  engine_version: string;
  schema_version: string;
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const res = await fetch("/api/v1/health", { signal });
  if (!res.ok) throw new Error(`health failed: ${res.status}`);
  return (await res.json()) as Health;
}
