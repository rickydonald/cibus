import type { RequestHandler } from "./$types";
import { handleListPasskeys } from "$lib/server/passkey-handlers";

export const GET: RequestHandler = handleListPasskeys;
