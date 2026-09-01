import { createAgent } from "../create-agent.js";
import { CURSOR_IMAGE } from "./constants.js";
import { runCursorInDocker } from "./run.js";

export const cursorAgent = createAgent({
  image: CURSOR_IMAGE,
  run: runCursorInDocker,
});
