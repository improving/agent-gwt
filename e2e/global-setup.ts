import { buildAgentImage } from "../src/index.js";

export default async function setup() {
  await buildAgentImage("claude");
}
