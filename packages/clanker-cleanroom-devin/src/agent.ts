import { Agent } from "clanker-cleanroom";

import { devinBinding } from "./binding.js";

export const devinAgent = Agent.fromBinding(devinBinding);
