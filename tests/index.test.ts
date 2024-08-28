import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "path";

const configPath = join(__dirname, "test-config.yaml");

describe("Quick Fake API Integration Tests", () => {
  describe("With configuration file", () => {

    let server: ChildProcess;

    beforeAll(() => {
      server = spawn("bun", ["src/index.ts", "-c", configPath]);
      return new Promise((resolve) => setTimeout(resolve, 1000));
    });

    afterAll(() => {
      server.kill();
      return new Promise((resolve) => setTimeout(resolve, 5000));
    });

    test("should start a basic server on port 8080", async () => {
      const response = await fetch("http://localhost:8080");
      expect(response.status).toBe(200);
      const body = await response.json() as { success: boolean };
      expect(body).toEqual({ success: true });
    });

    test("should create an endpoint for a specific host and methods", async () => {
      const response = await fetch("http://localhost:8080/users", { method: "GET" });
      expect(response.status).toBe(200);
      const body = await response.json() as { success: boolean };
      expect(body).toEqual({ success: true });
    });

    test("should return a custom response file with a specific status code", async () => {
      const response = await fetch("http://localhost:8080/create", { method: "POST" });
      expect(response.status).toBe(201);
      const body = await response.json() as { key: string };
      expect(body).toEqual({ key: "value" });
    });

    test("should validate incoming requests against a JSON schema", async () => {
      const response = await fetch("http://localhost:8080/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(response.status).toBe(200);
      const body = await response.json() as { success: boolean };
      expect(body).toEqual({ success: true });
    });

    test("should return 400 for invalid request body", async () => {
      const response = await fetch("http://localhost:8080/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "data" }),
      });
      expect(response.status).toBe(400);
      const body = await response.json() as { error: string };
      expect(body.error).toBe("Invalid request data");
    });
  });

  describe("With command-line arguments", () => {
    let server: ChildProcess;

    beforeAll(async () => {
      server = spawn("bun", [
        "src/index.ts",
        "-p", "8081",
        "-P", "/api",
        "-m", "GET,POST",
        "-r", '{"message":"Hello, World!"}',
        "-s", "201",
        "-V", '{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}',
        "-H", '{"X-Custom-Header":"Test"}',
        "--verbose"
      ]);

      return new Promise((resolve) => setTimeout(resolve, 5000));
    });

    afterAll(() => {
      server.kill();
    });

    test("should start a server on specified port", async () => {
      const response = await fetch("http://localhost:8081/api?name=john");
      expect(response.status).toBe(201);
      const body = await response.json() as { message: string };
      expect(body).toEqual({ message: "Hello, World!" });
    });

    test("should respect specified HTTP methods", async () => {
      const getResponse = await fetch("http://localhost:8081/api?name=john", { method: "GET" });
      expect(getResponse.status).toBe(201);

      const postResponse = await fetch("http://localhost:8081/api", { method: "POST", body: JSON.stringify({ name: "john" }) });
      expect(postResponse.status).toBe(201);

        const putResponse = await fetch("http://localhost:8081/api", { method: "PUT", body: JSON.stringify({ name: "john" })  });
      expect(putResponse.status).toBe(405);
    });

    test("should include custom headers", async () => {
      const response = await fetch("http://localhost:8081/api?name=john");
      expect(response.headers.get("X-Custom-Header")).toBe("Test");
    });

    test("should validate request body", async () => {
      const validResponse = await fetch("http://localhost:8081/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      });
      expect(validResponse.status).toBe(201);

      const invalidResponse = await fetch("http://localhost:8081/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: 30 }),
      });
      expect(invalidResponse.status).toBe(400);
    });
  });
});
