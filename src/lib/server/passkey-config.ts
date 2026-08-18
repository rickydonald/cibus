import { readFile } from "node:fs/promises";
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

async function loadInternalSecret(): Promise<Uint8Array> {
    const direct = env.PASSKEY_INTERNAL_SECRET;
    const file = env.PASSKEY_INTERNAL_SECRET_FILE?.trim();
    if (direct && file) {
        throw new PasskeyConfigurationError(
            "Configure PASSKEY_INTERNAL_SECRET or PASSKEY_INTERNAL_SECRET_FILE, not both",
        );
    }
    if (direct) return validateSecret(decodePasskeySecretValue(direct));
    if (!file) {
        throw new PasskeyConfigurationError(
            "PASSKEY_INTERNAL_SECRET or PASSKEY_INTERNAL_SECRET_FILE must be configured",
        );
    }

    let secret: Uint8Array;
    try {
        secret = await readFile(file);
    } catch {
        throw new PasskeyConfigurationError("Unable to read PASSKEY_INTERNAL_SECRET_FILE");
    }
    return validateSecret(secret);
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
    const internalSecret = await loadInternalSecret();
    return { ...relyingParty, backendBaseUrl, internalSecret };
}
