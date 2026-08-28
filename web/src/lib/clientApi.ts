export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "The request could not be completed");
  }
  return data;
}

export function runAction<T = { hash: string; status: string }>(
  action: string,
  input: Record<string, unknown>
) {
  return apiJson<T>("/api/actions", {
    method: "POST",
    body: JSON.stringify({ action, input }),
  });
}
