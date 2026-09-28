import { Agent } from "clanker-cleanroom";

import { copilotBinding } from "./binding.js";

export const copilotAgent = Agent.fromBinding(copilotBinding);
