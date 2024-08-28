import { expect, test, describe, mock, beforeEach, afterEach } from "bun:test";
import { IPCServer, IPCClient, Message } from "../src/ipc";
import { Config } from "../src/types";
import { clearStoredIPCPort } from "../src/storage";

const TEST_HTTP_PORT = 3000;

describe("IPC Tests", () => {
  let server: IPCServer;
  let client: IPCClient;
  const mockHandler = mock((message: Message) => {});

  beforeEach(async () => {
    await clearStoredIPCPort(TEST_HTTP_PORT);
    server = new IPCServer(mockHandler, TEST_HTTP_PORT);
    await server.start();
    client = new IPCClient();
    const connected = await client.connect(TEST_HTTP_PORT);
    expect(connected).toBe(true);
  });

  afterEach(async () => {
    client.close();
    await server.close();
    await clearStoredIPCPort(TEST_HTTP_PORT);
  });

  test("IPCServer should handle ADD_CONFIG message", async () => {
    const config: Config = {
      port: 3000,
      paths: [{ path: "/test", statusCode: 200 }],
    };
    const message: Message = { type: "ADD_CONFIG", pid: 1234, config };
    await client.sendMessage(message);

    // Wait for the message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockHandler).toHaveBeenCalledWith(message);
  });

  test("IPCServer should handle REMOVE_CONFIG message", async () => {
    const message: Message = { type: "REMOVE_CONFIG", pid: 1234 };
    await client.sendMessage(message);

    // Wait for the message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockHandler).toHaveBeenCalledWith(message);
  });

  test("IPCServer should handle multiple clients", async () => {
    const client2 = new IPCClient();
    const connected = await client2.connect(TEST_HTTP_PORT);
    expect(connected).toBe(true);

    const message1: Message = {
      type: "ADD_CONFIG",
      pid: 1234,
      config: { port: 3000, paths: [] },
    };
    const message2: Message = { type: "REMOVE_CONFIG", pid: 5678 };

    await client.sendMessage(message1);
    await client2.sendMessage(message2);

    // Wait for the messages to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockHandler).toHaveBeenCalledWith(message1);
    expect(mockHandler).toHaveBeenCalledWith(message2);

    client2.close();
  });
});
