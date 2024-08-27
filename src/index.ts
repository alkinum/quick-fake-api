#!/usr/bin/env bun
import yargs from 'yargs-parser';
import { serve } from 'bun';
import chalk from 'chalk';
import { validateConfig, loadConfigFile } from './configValidator.ts';
import { handleRequest } from './requestHandler.ts';
import { logRequest, logResponse } from './logger.ts';
import { Config } from './types.ts';

const args = yargs(process.argv.slice(2));

let config: Config;

if (args.c) {
  config = await loadConfigFile(args.c);
} else {
  config = {
    port: args.p ? Number(args.p) : 3000,
    host: args.h || undefined,
    paths: [{
      path: args._ && args._[0] ? args._[0] : args.P || '/',
      methods: args.m ? args.m.split(',') : undefined,
      response: args.r,
      statusCode: args.s || 200,
      validationSchema: args.V ? JSON.parse(args.V) : undefined,
      headers: args.H ? JSON.parse(args.H) : undefined,
    }],
  };
}

validateConfig(config);

serve({
  port: config.port,
  hostname: config.host,
  fetch: async (req) => {
    const loggedReq = await logRequest(req);
    const pathConfig = config.paths.find(p => new URL(req.url).pathname === p.path);
    if (!pathConfig) {
      return new Response('Not Found', { status: 404 });
    }
    const response = await handleRequest(loggedReq, pathConfig);
    logResponse(response);
    return response;
  },
});

console.log(chalk.green(`Server running at http://${config.host || 'localhost'}:${config.port}`));
