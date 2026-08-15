import type { RequestHandler } from "./$types";
import { handleAuthenticationOptions } from "$lib/server/passkey-handlers";

export const POST: RequestHandler = handleAuthenticationOptions;
