import { CONTAINER_HOME } from "clanker-cleanroom";

export const CURSOR_IMAGE = "clanker-cleanroom/cursor";
export const CONTAINER_AUTH_PATH = `${CONTAINER_HOME}/.config/cursor/auth.json`;
/** Agent CLI resume store (not the desktop IDE's `~/.config/cursor/chats`). */
export const CONTAINER_SESSION_PATH = `${CONTAINER_HOME}/.cursor/chats`;

export const defaultHostAuthFile = (home: string): string => `${home}/.config/cursor/auth.json`;
