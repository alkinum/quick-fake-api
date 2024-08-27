import Ajv from 'ajv';
import { PathConfig } from './types';

export async function handleRequest(req: Request, pathConfig: PathConfig): Promise<Response> {
  if (pathConfig.methods && !pathConfig.methods.includes(req.method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathConfig.validationSchema) {
    const ajv = new Ajv();
    const validate = ajv.compile(pathConfig.validationSchema);
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

  if (pathConfig.response) {
    const file = Bun.file(pathConfig.response);
    responseBody = await file.arrayBuffer();
    contentType = file.type;
  } else {
    responseBody = JSON.stringify({ success: true });
  }

  return new Response(responseBody, {
    status: pathConfig.statusCode,
    headers: { 'Content-Type': contentType, ...pathConfig.headers },
  });
}
