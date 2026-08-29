import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createEatRightFixtureAdapter } from "./fixture";
import { createEatRightModule } from "./module";
import { createEatRightHttpAdapter } from "./upstream";

const fixtureMode = dev && env.DEV_MODE === "true";
const sessionSecret = (
  env.SESSION_SECRET ??
  env.JWT_SECRET ??
  "local-development-secret-change-before-deploying"
).trim();

export const eatRight = createEatRightModule({
  remote: fixtureMode
    ? createEatRightFixtureAdapter()
    : createEatRightHttpAdapter(),
  sessionSecret,
  secureCookies: !dev,
});
