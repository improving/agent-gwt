import { createAgent } from "../create-agent.js";
import { cursorBinding } from "./binding.js";

export const cursorAgent = createAgent(cursorBinding);
