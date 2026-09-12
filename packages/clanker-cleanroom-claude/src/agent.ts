import { Agent } from "clanker-cleanroom";

import { claudeBinding } from "./binding.js";

export const claudeAgent = Agent.fromBinding(claudeBinding);
