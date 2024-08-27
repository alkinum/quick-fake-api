import { Ajv } from 'ajv';
import { PathConfig } from './types';
import { logger } from './logger';

async function getResponseBody(response: string): Promise<{ body: string | ArrayBuffer; contentType: string }> {
  try {
    const jsonBody = JSON.parse(response);
    return { body: JSON.stringify(jsonBody), contentType: 'application/json' };
  } catch {
    // Not a valid JSON, continue to file check
  }

  try {
    const file = Bun.file(response);
    if (await file.exists()) {
      return { body: await file.arrayBuffer(), contentType: file.type };
    }
  } catch (error) {
    logger.log('ERROR', 'Error reading file:', error);
    // File operation failed, fall through to return as plain text
  }

  return { body: response, contentType: 'text/plain' };
}

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
  let contentType: string;

  if (pathConfig.response) {
    const { body, contentType: responseContentType } = await getResponseBody(pathConfig.response);
    responseBody = body;
    contentType = responseContentType;
  } else {
    responseBody = JSON.stringify({ success: true });
    contentType = 'application/json';
  }

  return new Response(responseBody, {
    status: pathConfig.statusCode,
    headers: { 'Content-Type': contentType, ...pathConfig.headers },
  });
}
