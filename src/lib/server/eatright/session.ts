import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Cookies } from "@sveltejs/kit";
import type { RemoteSession } from "./contract";

const COOKIE_NAME = "RioX5EatRightSession";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function isRemoteSession(value: unknown): value is RemoteSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<RemoteSession>;
  return Boolean(
    session.cookies &&
      session.credentials?.username &&
      session.credentials?.password,
  );
}

export function createSessionCodec(secret: string, secure: boolean) {
  const key = createHash("sha256").update(secret).digest();

  function seal(session: RemoteSession): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(session), "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  function unseal(value: string): RemoteSession | null {
    try {
      const [version, iv, tag, encrypted] = value.split(".");
      if (version !== "v1" || !iv || !tag || !encrypted) return null;

      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(iv, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      const session: unknown = JSON.parse(plaintext);
      return isRemoteSession(session) ? session : null;
    } catch {
      return null;
    }
  }

  return {
    read(cookies: Cookies): RemoteSession | null {
      const value = cookies.get(COOKIE_NAME);
      return value ? unseal(value) : null;
    },
    write(cookies: Cookies, session: RemoteSession): void {
      cookies.set(COOKIE_NAME, seal(session), {
        path: "/",
        httpOnly: true,
        secure,
        sameSite: "lax",
        maxAge: MAX_AGE_SECONDS,
      });
    },
    clear(cookies: Cookies): void {
      cookies.delete(COOKIE_NAME, { path: "/" });
    },
  };
}
