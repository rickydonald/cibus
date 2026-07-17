import { errors, importSPKI, jwtVerify, type JWTVerifyOptions } from "jose";

const EXPIRY_SKEW_SECONDS = 30;
const HMAC_ALGORITHMS = new Set(["HS256", "HS384", "HS512"]);
const PUBLIC_KEY_ALGORITHMS = new Set([
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512",
    "EdDSA",
]);

export type EatRightJwtVerifierConfig = {
    algorithm: string;
    issuer?: string;
    audience?: string;
    secret?: string;
    publicKey?: string;
};

export type VerifiedEatRightJwt = {
    name: string;
    userid: string;
    expiresAt: number;
};

export class EatRightAuthConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EatRightAuthConfigurationError";
    }
}

const publicKeyCache = new Map<string, Promise<CryptoKey>>();

function validateConfig(config: EatRightJwtVerifierConfig) {
    if (!config.algorithm) {
        throw new EatRightAuthConfigurationError(
            "EatRight JWT algorithm must be configured",
        );
    }

    if (!!config.issuer !== !!config.audience) {
        throw new EatRightAuthConfigurationError(
            "Configure both EatRight JWT issuer and audience, or neither",
        );
    }

    const hasSecret = !!config.secret;
    const hasPublicKey = !!config.publicKey;
    if (hasSecret === hasPublicKey) {
        throw new EatRightAuthConfigurationError(
            "Configure exactly one EatRight JWT verification key",
        );
    }

    if (hasSecret) {
        if (!HMAC_ALGORITHMS.has(config.algorithm)) {
            throw new EatRightAuthConfigurationError(
                "EatRight JWT secrets require an HS256, HS384, or HS512 algorithm",
            );
        }
        if (new TextEncoder().encode(config.secret).byteLength < 32) {
            throw new EatRightAuthConfigurationError(
                "EatRight JWT HMAC secrets must be at least 32 bytes",
            );
        }
        return;
    }

    if (!PUBLIC_KEY_ALGORITHMS.has(config.algorithm)) {
        throw new EatRightAuthConfigurationError(
            "EatRight JWT public keys require an RS, PS, ES, or EdDSA algorithm",
        );
    }
}

async function getPublicKey(publicKey: string, algorithm: string): Promise<CryptoKey> {
    const cacheKey = `${algorithm}:${publicKey}`;
    let importedKey = publicKeyCache.get(cacheKey);
    if (!importedKey) {
        importedKey = importSPKI(publicKey, algorithm).catch((error) => {
            publicKeyCache.delete(cacheKey);
            throw new EatRightAuthConfigurationError(
                `Unable to import the EatRight JWT public key: ${error instanceof Error ? error.message : "invalid key"}`,
            );
        });
        publicKeyCache.set(cacheKey, importedKey);
    }
    return importedKey;
}

export async function verifyEatRightJwtWithConfig(
    accessToken: string,
    config: EatRightJwtVerifierConfig,
): Promise<VerifiedEatRightJwt | null> {
    validateConfig(config);

    const options: JWTVerifyOptions = {
        algorithms: [config.algorithm],
        typ: "JWT",
        clockTolerance: EXPIRY_SKEW_SECONDS,
        maxTokenAge: "7d",
        requiredClaims: ["exp", "iat", "sub", "name"],
        ...(config.issuer && config.audience
            ? { issuer: config.issuer, audience: config.audience }
            : {}),
    };

    try {
        const key = config.secret
            ? new TextEncoder().encode(config.secret)
            : await getPublicKey(config.publicKey as string, config.algorithm);
        const { payload } = await jwtVerify(accessToken, key, options);
        const name = typeof payload.name === "string" ? payload.name.trim() : "";
        const userid = typeof payload.sub === "string" ? payload.sub.trim() : "";

        if (
            !name ||
            !userid ||
            typeof payload.iat !== "number" ||
            typeof payload.exp !== "number"
        ) {
            return null;
        }
        return { name, userid, expiresAt: payload.exp };
    } catch (error) {
        if (error instanceof EatRightAuthConfigurationError) throw error;
        if (error instanceof errors.JOSEError) return null;
        return null;
    }
}
