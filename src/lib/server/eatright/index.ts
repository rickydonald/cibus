import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createEatRightFixtureAdapter } from "./fixture";
import { createEatRightModule } from "./module";
import { createEatRightHttpAdapter } from "./upstream";

/**
 * Composition root for the Eat Right module.
 *
 * The session cookie is not a bearer token — it is an AES-256-GCM sealed blob
 * that contains the user's upstream Eat Right *username and password*, because
 * the module reauthenticates against a scraped JSP backend that has no refresh
 * mechanism. That makes `sessionSecret` the single key protecting every user's
 * credentials: anyone who knows it can both decrypt a captured cookie and mint
 * a cookie for an arbitrary account.
 *
 * So it must never fall back to a constant baked into the repository. It
 * previously did, which meant any deployment without SESSION_SECRET set was
 * running on a publicly known key. Production now throws instead — the module
 * is imported lazily, so this surfaces as a 500 on the first request that
 * touches it rather than at process start.
 */

const fixtureMode = dev && env.DEV_MODE === "true";

/** Long enough that the sha256-derived key has real entropy behind it. */
const MIN_SECRET_LENGTH = 32;

const DEV_FALLBACK_SECRET = "local-development-secret-change-before-deploying";

function resolveSessionSecret(): string {
  const configured = (env.SESSION_SECRET ?? env.JWT_SECRET ?? "").trim();

  if (!configured) {
    if (!dev) {
      throw new Error(
        "SESSION_SECRET is not set. It encrypts session cookies that carry " +
          "user credentials, so this module refuses to serve requests " +
          "without it. Generate one with: openssl rand -base64 32",
      );
    }
    console.warn(
      "[eatright] SESSION_SECRET is not set; using the insecure development " +
        "fallback. Set it in .env before deploying.",
    );
    return DEV_FALLBACK_SECRET;
  }

  if (configured === DEV_FALLBACK_SECRET && !dev) {
    throw new Error(
      "SESSION_SECRET is still the development placeholder. Generate a real " +
        "one with: openssl rand -base64 32",
    );
  }

  if (configured.length < MIN_SECRET_LENGTH && !dev) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }

  return configured;
}

export const eatRight = createEatRightModule({
  remote: fixtureMode
    ? createEatRightFixtureAdapter()
    : createEatRightHttpAdapter(),
  sessionSecret: resolveSessionSecret(),
  secureCookies: !dev,
});
