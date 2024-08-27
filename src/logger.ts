import chalk from 'chalk';

export async function logRequest(req: Request): Promise<Request> {
  const { method, url, headers } = req;
  const body = req.headers.get('content-type') === 'application/json' ? await req.json() : undefined;

  console.log(chalk.cyan('Incoming Request:'));
  console.log(chalk.yellow(`${method} ${url}`));
  console.log(chalk.magenta('Headers:'), headers);
  if (body) {
    console.log(chalk.magenta('Body:'), body);
  }

  return new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(body),
  });
}

export function logResponse(res: Response): void {
  console.log(chalk.cyan('Outgoing Response:'));
  console.log(chalk.yellow(`Status: ${res.status}`));
  console.log(chalk.magenta('Headers:'), res.headers);
}
