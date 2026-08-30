import { eatRight } from "$lib/server/eatright/index";

export const GET = eatRight.handler("wallet");
export const POST = eatRight.handler("recharge");
