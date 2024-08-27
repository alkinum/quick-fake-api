import chalk from "chalk";
import yaml from "js-yaml";

import { Config, PathConfig } from "./types";

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export async function loadConfigFile(filePath: string): Promise<Config> {
  const fileContent = await Bun.file(filePath).text();
  let config: Config;

  if (filePath.endsWith(".json")) {
    config = JSON.parse(fileContent);
  } else if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    config = yaml.load(fileContent) as Config;
  } else {
    throw new ConfigValidationError("Unsupported file format. Please use JSON or YAML.");
  }

  return config;
}

export function validateConfig(config: Config): void {
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    throw new ConfigValidationError("Invalid port number");
  }

  config.paths.forEach(validatePathConfig);
}

function validatePathConfig(pathConfig: PathConfig): void {
  if (
    pathConfig.methods &&
    !pathConfig.methods.every((m) =>
      ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"].includes(m),
    )
  ) {
    throw new ConfigValidationError(`Invalid HTTP method for path ${pathConfig.path}`);
  }

  if (pathConfig.statusCode < 100 || pathConfig.statusCode > 599) {
    throw new ConfigValidationError(`Invalid status code for path ${pathConfig.path}`);
  }

  if (pathConfig.response) {
    // Check if it's a valid JSON string
    try {
      JSON.parse(pathConfig.response);
    } catch (e) {
      // If not a JSON string, check if it's a file path
      if (!Bun.file(pathConfig.response).exists()) {
        throw new ConfigValidationError(
          `Invalid response: Neither a valid JSON string nor an existing file path for ${pathConfig.path}`
        );
      }
    }
  }

  if (
    pathConfig.validationSchema &&
    typeof pathConfig.validationSchema !== "object"
  ) {
    throw new ConfigValidationError(`Invalid validation schema for path ${pathConfig.path}`);
  }
}
