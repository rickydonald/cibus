import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import {
    decodePasskeySecretValue,
    normalizePasskeyBackendBaseUrl,
    PasskeyConfigurationError,
    validatePasskeyRelyingPartyConfig,
    type PasskeyRelyingPartyConfig,
} from "./passkey-core";

const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 4096;

export type PasskeyRuntimeConfig = PasskeyRelyingPartyConfig & {
    backendBaseUrl: string;
    internalSecret: Uint8Array;
};

function validateSecret(secret: Uint8Array): Uint8Array {
    if (secret.byteLength < MIN_SECRET_BYTES || secret.byteLength > MAX_SECRET_BYTES) {
        throw new PasskeyConfigurationError(
            `Passkey internal secret must be between ${MIN_SECRET_BYTES} and ${MAX_SECRET_BYTES} bytes`,
        );
    }
    return secret;
}

// The secret is carried in the environment as a string. The Java side reads the
// same variable and decodes it identically (passkeyDecodeSecretValue in
// ajax/api/passkeys.jsp) — the two are one contract, and a mismatch surfaces
// only as a failed HMAC at request time.
function loadInternalSecret(): Uint8Array {
    const direct = env.PASSKEY_INTERNAL_SECRET?.trim();
    if (!direct) {
        throw new PasskeyConfigurationError("PASSKEY_INTERNAL_SECRET must be configured");
    }
    return validateSecret(decodePasskeySecretValue(direct));
}

export async function getPasskeyRuntimeConfig(): Promise<PasskeyRuntimeConfig> {
    const relyingParty = validatePasskeyRelyingPartyConfig({
        rpID: env.PASSKEY_RP_ID,
        rpName: env.PASSKEY_RP_NAME,
        origins: env.PASSKEY_ORIGINS,
    });
    const backendBaseUrl = normalizePasskeyBackendBaseUrl(
        env.PASSKEY_FOODCOURT_API_BASE_URL || env.FOODCOURT_API_BASE_URL,
        { allowInsecureTransport: dev },
    );
    const internalSecret = loadInternalSecret();
    return { ...relyingParty, backendBaseUrl, internalSecret };
}
