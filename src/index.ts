#!/usr/bin/env bun
import yargs from 'yargs-parser';
import { serve } from 'bun';
import chalk from 'chalk';
import { validateConfig } from './configValidator.ts';
import { handleRequest } from './requestHandler.ts';
import { logRequest, logResponse } from './logger.ts';
import { Config } from './types.ts';

const args = yargs(process.argv.slice(2));

const config: Config = {
  port: args.p || 3000,
  host: args.h || undefined,
  methods: args.m ? args.m.split(',') : undefined,
  response: args.r,
  statusCode: args.s || 200,
  path: args._ && args._[0] ? args._[0] : args.P || '/',
  validationSchema: args.V ? JSON.parse(args.V) : undefined,
  headers: args.H ? JSON.parse(args.H) : undefined,
};

validateConfig(config);

serve({
  port: config.port,
  hostname: config.host,
  fetch: async (req) => {
    const loggedReq = await logRequest(req);
    const response = await handleRequest(loggedReq, config);
    logResponse(response);
    return response;
  },
});

console.log(chalk.green(`Server running at http://${config.host || 'localhost'}:${config.port}`));
