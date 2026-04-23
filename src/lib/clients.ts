import { z } from "zod";

const ClientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  locationId: z.string().min(1),
  pit: z.string().min(1),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
});

export type Client = z.infer<typeof ClientSchema>;

let cache: Client[] | null = null;

export function getClients(): Client[] {
  if (cache) return cache;
  const raw = process.env.PORTAL_CLIENTS ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    const list = z.array(ClientSchema).parse(parsed);
    cache = list;
    return list;
  } catch (err) {
    console.error("PORTAL_CLIENTS is not valid JSON:", err);
    cache = [];
    return [];
  }
}

export function getClient(id: string): Client | null {
  return getClients().find((c) => c.id === id) ?? null;
}

export function publicClient(c: Client) {
  const { pit, ...rest } = c;
  void pit;
  return rest;
}
