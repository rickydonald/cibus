import { describe, expect, it, vi } from "vitest";
import type { RemoteSession } from "./contract";
import { createEatRightHttpAdapter } from "./upstream";

const session: RemoteSession = {
  credentials: { username: "student", password: "password" },
  cookies: "session=active",
};

describe("Eat Right HTTP adapter", () => {
  it("normalizes wrapped wallet transaction lists", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      transactions: [{ type: "CREDIT", amount: 200 }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const remote = createEatRightHttpAdapter(fetch as typeof globalThis.fetch);

    await expect(remote.wallet(session)).resolves.toEqual([
      { type: "CREDIT", amount: 200 },
    ]);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
