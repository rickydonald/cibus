import type { RequestHandler } from "./$types";
import { handleAuthenticationVerify } from "$lib/server/passkey-handlers";

export const POST: RequestHandler = handleAuthenticationVerify;
