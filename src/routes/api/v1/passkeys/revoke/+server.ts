import type { RequestHandler } from "./$types";
import { handleRevokePasskey } from "$lib/server/passkey-handlers";

export const POST: RequestHandler = handleRevokePasskey;
