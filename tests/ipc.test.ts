import { expect, test, describe, mock, beforeEach, afterEach } from "bun:test";
import { IPCServer, IPCClient, Message, initializeIPC } from "../src/ipc";
import { Config } from "../src/types";
import { storeIPCPort, getStoredIPCPort, clearStoredIPCPort } from "../src/storage";

describe("IPC Tests", () => {
  let server: IPCServer;
  let client: IPCClient;
  const mockHandler = mock((message: Message) => {});

  beforeEach(async () => {
    await clearStoredIPCPort();
    await initializeIPC();
    server = new IPCServer(mockHandler);
    client = new IPCClient();
  });

  afterEach(async () => {
    server.close();
    client.close();
    await clearStoredIPCPort();
  });

  test("IPCServer should start and store port", async () => {
    await server.start();
    const port = server.getPort();
    const storedPort = await getStoredIPCPort();
    expect(storedPort).toBe(port);
  });

  test("IPCClient should connect to the stored port", async () => {
    await server.start();
    const isConnected = await client.connect();
    expect(isConnected).toBe(true);
  });

  test("IPCClient should fail to connect if no port is stored", async () => {
    await clearStoredIPCPort();
    const isConnected = await client.connect();
    expect(isConnected).toBe(false);
  });

  test("IPCServer should handle ADD_CONFIG message", async () => {
    await client.connect();
    const config: Config = {
      port: 3000,
      paths: [{ path: "/test", statusCode: 200 }],
    };
    const message: Message = { type: "ADD_CONFIG", pid: 1234, config };
    await client.sendMessage(message);

    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for message processing
    expect(mockHandler).toHaveBeenCalledWith(message);
  });

  test("IPCServer should handle REMOVE_CONFIG message", async () => {
    await client.connect();
    const message: Message = { type: "REMOVE_CONFIG", pid: 1234 };
    await client.sendMessage(message);

    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for message processing
    expect(mockHandler).toHaveBeenCalledWith(message);
  });

  test("IPCClient should handle server disconnection", async () => {
    await client.connect();
    server.close();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for server to close

    await expect(client.sendMessage({ type: "REMOVE_CONFIG", pid: 1234 }))
      .rejects.toThrow('Not connected to server');
  });

  test("IPCServer should handle multiple clients", async () => {
    const client2 = new IPCClient();
    await client.connect();
    await client2.connect();

    const message1: Message = {
      type: "ADD_CONFIG",
      pid: 1234,
      config: { port: 3000, paths: [] },
    };
    const message2: Message = { type: "REMOVE_CONFIG", pid: 5678 };

    await client.sendMessage(message1);
    await client2.sendMessage(message2);

    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for message processing

    expect(mockHandler).toHaveBeenCalledWith(message1);
    expect(mockHandler).toHaveBeenCalledWith(message2);

    client2.close();
  });

  test("IPCServer should clear stored port on close", async () => {
    await server.start();
    await server.close();
    const storedPort = await getStoredIPCPort();
    expect(storedPort).toBe(null);
  });
});
