import type { Cookies, RequestEvent } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { createEatRightFixtureAdapter } from "./fixture";
import { createEatRightModule } from "./module";

function createCookies() {
  const values = new Map<string, string>();
  return {
    values,
    cookies: {
      get: (name: string) => values.get(name),
      set: (name: string, value: string) => values.set(name, value),
      delete: (name: string) => values.delete(name),
    } as unknown as Cookies,
  };
}

function event(input: {
  cookies: Cookies;
  method?: string;
  path?: string;
  body?: unknown;
  params?: Record<string, string>;
}): RequestEvent {
  const url = new URL(input.path ?? "http://cibus.test/");
  return {
    cookies: input.cookies,
    params: input.params ?? {},
    request: new Request(url, {
      method: input.method ?? "GET",
      headers: input.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    }),
    url,
  } as RequestEvent;
}

function createModule() {
  return createEatRightModule({
    remote: createEatRightFixtureAdapter(),
    sessionSecret: "test-secret",
    secureCookies: false,
    sleep: async () => {},
  });
}

describe("Eat Right module interface", () => {
  it("connects and serves an account through an encrypted session", async () => {
    const module = createModule();
    const { cookies, values } = createCookies();

    const login = await module.handler("login")(event({
      cookies,
      method: "POST",
      path: "http://cibus.test/api/v1/login",
      body: { userId: "student", password: "private-password" },
    }));

    expect(login.status).toBe(200);
    const session = values.get("RioX5EatRightSession");
    expect(session).toMatch(/^v1\./);
    expect(session).not.toContain("student");
    expect(session).not.toContain("private-password");

    const account = await module.handler("account")(event({
      cookies,
      path: "http://cibus.test/api/v1/account/show",
    }));
    expect(account.status).toBe(200);
    expect(await account.json()).toMatchObject({
      user: "Dev User (DEV001)",
      walletBalance: "250.00",
      reauthenticated: false,
    });
  });

  it("presents one stable session error for protected operations", async () => {
    const module = createModule();
    const { cookies } = createCookies();
    const response = await module.handler("orders")(event({
      cookies,
      path: "http://cibus.test/api/v1/orders",
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Eat Right account is not connected",
      errorCode: "eatright_session_missing",
    });
  });

  it("validates a cart before touching the upstream adapter", async () => {
    const module = createModule();
    const { cookies } = createCookies();
    const response = await module.handler("placeOrder")(event({
      cookies,
      method: "POST",
      path: "http://cibus.test/api/v1/order",
      body: { cart: [] },
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: "cart_empty" });
  });

  it("orchestrates placement, payment, and history confirmation", async () => {
    const module = createModule();
    const { cookies } = createCookies();
    await module.handler("login")(event({
      cookies,
      method: "POST",
      body: { userId: "student", password: "password" },
    }));

    const response = await module.handler("placeOrder")(event({
      cookies,
      method: "POST",
      path: "http://cibus.test/api/v1/order",
      body: {
        cart: [{
          id: 101,
          itemname: "Chicken Momo - Steamed",
          amount: 120,
          qty: 2,
          shopno: 1,
          outletid: 1,
          outletname: "Momo's Kitchen",
          available_qty: 15,
          categoryname: "Momo",
        }],
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      grandTotal: 240,
      isRecorded: true,
      payment: { status: "success" },
    });
  });
});
