import type { RequestHandler } from "./$types";
import { handleRegistrationOptions } from "$lib/server/passkey-handlers";

export const POST: RequestHandler = handleRegistrationOptions;
