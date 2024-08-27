export interface Config {
  port: number;
  host?: string;
  methods?: string[];
  response?: string;
  statusCode: number;
  path: string;
  validationSchema?: object;
  headers?: Record<string, string>;
}
