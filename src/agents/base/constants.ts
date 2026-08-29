export const BASE_IMAGE = "agent-gwt/base:local";
export const BASE_DOCKERFILE_RELATIVE = "docker/base/Dockerfile";

/** Home directory inside every agent image; world-writable so any host uid can use it. */
export const CONTAINER_HOME = "/home/agent";
/** Bind-mount target for the test workspace inside every agent image. */
export const CONTAINER_WORKSPACE = "/workspace";
