#!/usr/bin/env bun
import yargs from "yargs-parser";
import chalk from "chalk";
import { loadConfigFile } from "./configValidator";
import { Config } from "./types";
import { processManager } from "./processManager";
import { initializeIPC } from './ipc';
import { logger } from './logger';

const args = yargs(process.argv.slice(2));

let config: Config;

if (args.c) {
  config = await loadConfigFile(args.c);
} else {
  config = {
    port: args.p ? Number(args.p) : 3000,
    host: args.h || undefined,
    paths: [
      {
        path: (args._ && args._[0]) ? args._[0] : args.P || "/",
        methods: args.m ? args.m.split(",") : undefined,
        response: args.r,
        statusCode: args.s || 200,
        validationSchema: args.V ? JSON.parse(args.V) : undefined,
        headers: args.H ? JSON.parse(args.H) : undefined,
      },
    ],
  };
}

async function main() {
  await initializeIPC();

  const started = await processManager.start(config);

  if (!started) {
    console.log(
      chalk.yellow("Configuration added to existing instance. This process will now exit.")
    );
    process.exit(0);
  }

  process.on("SIGINT", () => {
    processManager.shutdown();
    process.exit(0);
  });
}

main().catch(error => {
  logger.log('ERROR', 'An error occurred:', error);
  process.exit(1);
});
