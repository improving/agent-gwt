import { PACKAGE_ROOT } from "../../package-root.js";
import { createAgent } from "../create-agent.js";
import {
  CURSOR_DOCKERFILE_RELATIVE,
  CURSOR_IMAGE,
} from "./constants.js";
import { runCursorInDocker } from "./run.js";

export const cursorAgent = createAgent({
  dockerfileRelative: CURSOR_DOCKERFILE_RELATIVE,
  packageRoot: PACKAGE_ROOT,
  image: CURSOR_IMAGE,
  run: runCursorInDocker,
});
