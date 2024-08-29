import { expect, test, describe, mock, beforeEach, afterEach } from "bun:test";
import { IPCServer, IPCClient, Message, ConnectionResult } from "../src/ipc";
import { Config } from "../src/types";
import { clearStoredIPCPort } from "../src/storage";

const TEST_HTTP_PORT = 3000;

describe("IPC Tests", () => {
  let server: IPCServer;
  let client: IPCClient;
  const mockHandler = mock((message: Message) => {});
  const mockDisconnectHandler = mock((pid: number) => {});

  beforeEach(async () => {
    await clearStoredIPCPort(TEST_HTTP_PORT);
    server = new IPCServer(mockHandler, mockDisconnectHandler, TEST_HTTP_PORT);
    await server.start();
    client = new IPCClient();
  });

  afterEach(async () => {
    client.close();
    await server.close();
    await clearStoredIPCPort(TEST_HTTP_PORT);
  });

  test("IPCClient should connect successfully", async () => {
    const connectionResult = await client.connect(TEST_HTTP_PORT);
    expect(connectionResult).toBe(ConnectionResult.Connected);
  });

  test("IPCServer should handle ADD_CONFIG message", async () => {
    await client.connect(TEST_HTTP_PORT);
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
    await client.connect(TEST_HTTP_PORT);
    const message: Message = { type: "REMOVE_CONFIG", pid: 1234 };
    await client.sendMessage(message);

    // Wait for the message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockHandler).toHaveBeenCalledWith(message);
  });

  test("IPCServer should handle multiple clients", async () => {
    await client.connect(TEST_HTTP_PORT);
    const client2 = new IPCClient();
    const connectionResult = await client2.connect(TEST_HTTP_PORT);
    expect(connectionResult).toBe(ConnectionResult.Connected);

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

  test("IPCClient should handle connection failure", async () => {
    await server.close(); // Close the server to simulate connection failure
    const connectionResult = await client.connect(TEST_HTTP_PORT);
    expect(connectionResult).toBe(ConnectionResult.FailedToConnect);
  });

  test("IPCClient should handle no stored port", async () => {
    await clearStoredIPCPort(TEST_HTTP_PORT);
    const connectionResult = await client.connect(TEST_HTTP_PORT);
    expect(connectionResult).toBe(ConnectionResult.NoStoredPort);
  });

  test("IPCServer should call disconnect handler when client disconnects", async () => {
    await client.connect(TEST_HTTP_PORT);
    const clientPid = process.pid;
    client.close();

    // Wait for the disconnection to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockDisconnectHandler).toHaveBeenCalledWith(clientPid);
  });
});
