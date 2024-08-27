import chalk from 'chalk';
import { Config, PathConfig } from './types';
import yaml from 'js-yaml';

export async function loadConfigFile(filePath: string): Promise<Config> {
  const fileContent = await Bun.file(filePath).text();
  let config: Config;

  if (filePath.endsWith('.json')) {
    config = JSON.parse(fileContent);
  } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    config = yaml.load(fileContent) as Config;
  } else {
    console.error(chalk.red('Unsupported file format. Please use JSON or YAML.'));
    process.exit(1);
  }

  return config;
}

export function validateConfig(config: Config): void {
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    console.error(chalk.red('Invalid port number'));
    process.exit(1);
  }

  config.paths.forEach(validatePathConfig);
}

function validatePathConfig(pathConfig: PathConfig): void {
  if (pathConfig.methods && !pathConfig.methods.every(m => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(m))) {
    console.error(chalk.red(`Invalid HTTP method for path ${pathConfig.path}`));
    process.exit(1);
  }

  if (pathConfig.statusCode < 100 || pathConfig.statusCode > 599) {
    console.error(chalk.red(`Invalid status code for path ${pathConfig.path}`));
    process.exit(1);
  }

  if (pathConfig.response && !Bun.file(pathConfig.response).exists()) {
    console.error(chalk.red(`Response file does not exist for path ${pathConfig.path}`));
    process.exit(1);
  }

  if (pathConfig.validationSchema && typeof pathConfig.validationSchema !== 'object') {
    console.error(chalk.red(`Invalid validation schema for path ${pathConfig.path}`));
    process.exit(1);
  }
}
