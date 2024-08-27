import chalk from 'chalk';
import { Config } from './types';

export function validateConfig(config: Config): void {
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    console.error(chalk.red('Invalid port number'));
    process.exit(1);
  }

  if (config.methods && !config.methods.every(m => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(m))) {
    console.error(chalk.red('Invalid HTTP method'));
    process.exit(1);
  }

  if (config.statusCode < 100 || config.statusCode > 599) {
    console.error(chalk.red('Invalid status code'));
    process.exit(1);
  }

  if (config.response && !Bun.file(config.response).exists()) {
    console.error(chalk.red('Response file does not exist'));
    process.exit(1);
  }

  if (config.validationSchema && typeof config.validationSchema !== 'object') {
    console.error(chalk.red('Invalid validation schema'));
    process.exit(1);
  }

  if (config.headers && typeof config.headers !== 'object') {
    console.error(chalk.red('Invalid headers'));
    process.exit(1);
  }
}
