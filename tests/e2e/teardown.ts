import { teardown } from "./setup.js";

export default async function globalTeardown() {
  await teardown();
}
