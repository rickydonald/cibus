import { env } from "$env/dynamic/private";
import {
    verifyEatRightJwtWithConfig,
    type EatRightJwtVerifierConfig,
} from "./eatright-jwt-core";

function getVerifierConfig(): EatRightJwtVerifierConfig {
    return {
        algorithm: env.EATRIGHT_JWT_ALGORITHM?.trim() ?? "",
        issuer: env.EATRIGHT_JWT_ISSUER?.trim() || undefined,
        audience: env.EATRIGHT_JWT_AUDIENCE?.trim() || undefined,
        secret: env.EATRIGHT_JWT_SECRET?.trim() || undefined,
        publicKey: env.EATRIGHT_JWT_PUBLIC_KEY?.replace(/\\n/g, "\n").trim() || undefined,
    };
}

export function verifyEatRightJwt(accessToken: string) {
    return verifyEatRightJwtWithConfig(accessToken, getVerifierConfig());
}

export { EatRightAuthConfigurationError } from "./eatright-jwt-core";
