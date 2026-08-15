import type { RequestHandler } from "./$types";
import { handleRegistrationVerify } from "$lib/server/passkey-handlers";

export const POST: RequestHandler = handleRegistrationVerify;
