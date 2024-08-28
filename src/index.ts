#!/usr/bin/env bun
import yargs from "yargs-parser";
import chalk from "chalk";
import { loadConfigFile } from "./configValidator";
import { Config } from "./types";
import { processManager } from "./processManager";
import { logger } from './logger';
import { setVerboseMode } from './logger';

const args = yargs(process.argv.slice(2));

// 添加 verbose 参数处理
const verbose = args.verbose || false;
setVerboseMode(verbose);

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

logger.debug('Config:', config);

async function main() {
  const hasRunningInstance = await processManager.start(config);

  if (!hasRunningInstance) {
    console.log(
      chalk.yellow("Configuration added to existing instance. This process will remain running until you close it or the existing instance closes.")
    );

    await processManager.waitForExistingInstanceToClose();

    console.log(chalk.green("Existing instance has closed. Attempting to restart..."));
    await processManager.start(config);
  }

  const cleanup = async () => {
    await processManager.shutdown();
    process.exit(0);
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  process.on("uncaughtException", async (error) => {
    logger.error('Uncaught exception:', error);
    await cleanup();
  });
}

main().catch(error => {
  logger.error('Main process error:', error);
  process.exit(1);
});
