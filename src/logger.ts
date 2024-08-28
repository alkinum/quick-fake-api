import chalk from 'chalk';

let verboseMode = false;

export function setVerboseMode(mode: boolean) {
  verboseMode = mode;
}

export const logger = {
  debug: (...messages: any[]) => {
    if (!verboseMode) return;
    logWithLevel('DEBUG', chalk.blue, ...messages);
  },
  info: (...messages: any[]) => {
    logWithLevel('INFO', chalk.green, ...messages);
  },
  warn: (...messages: any[]) => {
    logWithLevel('WARN', chalk.yellow, ...messages);
  },
  error: (...messages: any[]) => {
    logWithLevel('ERROR', chalk.red, ...messages);
  }
};

function logWithLevel(level: string, colorFunc: (str: string) => string, ...messages: any[]) {
  const timestamp = new Date().toISOString();
  const coloredLevel = colorFunc(level);
  console.log(`${timestamp} [${coloredLevel}]`, ...messages);
}

export async function logRequest(req: Request): Promise<Request> {
  logger.info(`Incoming ${req.method} request to ${req.url}`);
  return req;
}

export function logResponse(res: Response): void {
  logger.info(`Outgoing response with status ${res.status}`);
}
