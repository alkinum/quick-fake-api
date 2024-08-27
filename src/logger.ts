import chalk from 'chalk';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class Logger {
  log(level: LogLevel, message: string, ...args: any[]): void {
    const color = this.getColor(level);
    // @ts-ignore
    console.log(chalk[color](`[${level}] ${message}`), ...args);
  }

  private getColor(level: LogLevel): keyof typeof chalk {
    switch (level) {
      case 'INFO':
        return 'cyan';
      case 'WARN':
        return 'yellow';
      case 'ERROR':
        return 'red';
      case 'DEBUG':
        return 'magenta';
      default:
        return 'white';
    }
  }
}

const logger = new Logger();

export async function logRequest(req: Request): Promise<Request> {
  const { method, url, headers } = req;
  const body = req.headers.get('content-type') === 'application/json' ? await req.json() : undefined;

  logger.log('INFO', 'Incoming Request:');
  logger.log('INFO', `${method} ${url}`);
  logger.log('DEBUG', 'Headers:', headers);
  if (body) {
    logger.log('DEBUG', 'Body:', body);
  }

  return new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(body),
  });
}

export function logResponse(res: Response): void {
  logger.log('INFO', 'Outgoing Response:');
  logger.log('INFO', `Status: ${res.status}`);
  logger.log('DEBUG', 'Headers:', res.headers);
}

export { logger, LogLevel };
