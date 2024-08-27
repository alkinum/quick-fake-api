import { expect, test, describe, mock } from "bun:test";
import { validateConfig, loadConfigFile } from "../src/configValidator";
import { Config } from "../src/types";

describe("validateConfig", () => {
  test("should not throw for valid config", () => {
    const validConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          statusCode: 200,
        },
      ],
    };
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  test("should throw for invalid port (too high)", () => {
    const invalidConfig: Config = {
      port: 70000,
      paths: [
        {
          path: "/test",
          statusCode: 200,
        },
      ],
    };
    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  test("should throw for invalid port (too low)", () => {
    const invalidConfig: Config = {
      port: 0,
      paths: [
        {
          path: "/test",
          statusCode: 200,
        },
      ],
    };
    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  test("should throw for invalid method", () => {
    const invalidConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          methods: ["INVALID"],
          statusCode: 200,
        },
      ],
    };
    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  test("should not throw for valid methods", () => {
    const validConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
          statusCode: 200,
        },
      ],
    };
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  test("should throw for invalid status code (too low)", () => {
    const invalidConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          statusCode: 99,
        },
      ],
    };
    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  test("should throw for invalid status code (too high)", () => {
    const invalidConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          statusCode: 600,
        },
      ],
    };
    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  test("should not throw for valid JSON response", () => {
    const validConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          statusCode: 200,
          response: '{"key": "value"}',
        },
      ],
    };
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  test("should not throw for valid validation schema", () => {
    const validConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          statusCode: 200,
          validationSchema: { type: "object", properties: { key: { type: "string" } } },
        },
      ],
    };
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  test("should throw for invalid validation schema", () => {
    const invalidConfig: Config = {
      port: 3000,
      paths: [
        {
          path: "/test",
          statusCode: 200,
          // @ts-ignore: Invalid schema
          validationSchema: "not an object",
        },
      ],
    };
    expect(() => validateConfig(invalidConfig)).toThrow();
  });
});
