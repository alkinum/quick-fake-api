import { expect, test, describe, mock } from "bun:test";
import { handleRequest } from "../src/requestHandler";
import { PathConfig } from "../src/types";

describe("handleRequest", () => {
  test("should return 405 for unsupported method", async () => {
    const req = new Request("http://localhost/test", { method: "POST" });
    const pathConfig: PathConfig = {
      path: "/test",
      methods: ["GET"],
      statusCode: 200,
    };

    const response = await handleRequest(req, pathConfig);
    expect(response.status).toBe(405);
    expect(await response.text()).toBe("Method Not Allowed");
  });

  test("should return 400 for invalid request body", async () => {
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    });
    const pathConfig: PathConfig = {
      path: "/test",
      methods: ["POST"],
      statusCode: 200,
      validationSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    };

    const response = await handleRequest(req, pathConfig);
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error).toBe("Invalid request body");
  });

  test("should return JSON response", async () => {
    const req = new Request("http://localhost/test", { method: "GET" });
    const pathConfig: PathConfig = {
      path: "/test",
      statusCode: 200,
      response: '{"key": "value"}',
    };

    const response = await handleRequest(req, pathConfig);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ key: "value" });
  });

  test("should return default response when no response is specified", async () => {
    const req = new Request("http://localhost/test", { method: "GET" });
    const pathConfig: PathConfig = {
      path: "/test",
      statusCode: 200,
    };

    const response = await handleRequest(req, pathConfig);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ success: true });
  });

  test("should include custom headers in response", async () => {
    const req = new Request("http://localhost/test", { method: "GET" });
    const pathConfig: PathConfig = {
      path: "/test",
      statusCode: 200,
      headers: { "X-Custom-Header": "CustomValue" },
    };

    const response = await handleRequest(req, pathConfig);
    expect(response.headers.get("X-Custom-Header")).toBe("CustomValue");
  });
});
