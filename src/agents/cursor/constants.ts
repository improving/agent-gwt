import { CONTAINER_HOME } from "../base/constants.js";

export const CURSOR_IMAGE = "agent-gwt/cursor-cli:local";
export const CONTAINER_AUTH_PATH = `${CONTAINER_HOME}/.config/cursor/auth.json`;
export const CURSOR_DOCKERFILE_RELATIVE = "docker/cursor/Dockerfile";

export const defaultHostAuthFile = (home: string): string => `${home}/.config/cursor/auth.json`;
