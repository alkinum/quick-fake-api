export interface PathConfig {
  path: string;
  methods?: string[];
  response?: string;
  statusCode: number;
  validationSchema?: object;
  headers?: Record<string, string>;
}

export interface Config {
  port: number;
  host?: string;
  paths: PathConfig[];
}
