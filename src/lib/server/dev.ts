import { env } from "$env/dynamic/private";

export const DEV_MODE = env.DEV_MODE === "true";
