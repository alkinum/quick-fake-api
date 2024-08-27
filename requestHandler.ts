import Ajv from 'ajv';

import { Config } from './src/types';

export async function handleRequest(req: Request, config: Config): Promise<Response> {
  if (config.host && new URL(req.url).hostname !== config.host) {
    return new Response('Not Found', { status: 404 });
  }

  if (config.methods && !config.methods.includes(req.method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (new URL(req.url).pathname !== config.path) {
    return new Response('Not Found', { status: 404 });
  }

  if (config.validationSchema) {
    const ajv = new Ajv();
    const validate = ajv.compile(config.validationSchema);
    const body = await req.json();
    if (!validate(body)) {
      return new Response(JSON.stringify({ error: 'Invalid request body', details: validate.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let responseBody: string | ArrayBuffer;
  let contentType = 'application/json';

  if (config.response) {
    const file = Bun.file(config.response);
    responseBody = await file.arrayBuffer();
    contentType = file.type;
  } else {
    responseBody = JSON.stringify({ success: true });
  }

  return new Response(responseBody, {
    status: config.statusCode,
    headers: { 'Content-Type': contentType },
  });
}
