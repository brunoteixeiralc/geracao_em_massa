import "dotenv/config";
import { parseEnv } from "./config/env.js";

const env = parseEnv(process.env);

console.log(`Reels bot service booted in ${env.nodeEnv}`);
