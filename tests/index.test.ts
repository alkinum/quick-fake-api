import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn, ChildProcess } from "node:child_process";

let server: ChildProcess;

beforeAll(() => {
  server = spawn("bun", ["src/index.ts", "-p", "8080"]);
});

afterAll(() => {
  server.kill();
});

describe("Quick Fake API Integration Tests", () => {
  test("should start a basic server on port 8080", async () => {
    const response = await fetch("http://localhost:8080");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  test("should create an endpoint for a specific host and methods", async () => {
    const response = await fetch("http://localhost:8080/users", { method: "GET" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  test("should return a custom response file with a specific status code", async () => {
    const response = await fetch("http://localhost:8080/create", { method: "POST" });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ key: "value" });
  });

  test("should validate incoming requests against a JSON schema", async () => {
    const response = await fetch("http://localhost:8080/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  test("should return 400 for invalid request body", async () => {
    const response = await fetch("http://localhost:8080/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request body");
  });
});
