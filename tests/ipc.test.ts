import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { IPCServer, IPCClient, ConnectionResult } from "../src/ipc";
import { getStoredIPCPort, clearStoredIPCPort } from "../src/storage";
import { Config } from "../src/types";

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("IPC Tests", () => {
  const httpPort = 8080;
  const testDelay = 500;
  let sharedServer: IPCServer;

  beforeAll(async () => {
    sharedServer = new IPCServer(
      () => {},
      () => {},
      httpPort
    );
    await sharedServer.start();
  });

  afterAll(async () => {
    await sharedServer.close();
    await clearStoredIPCPort(httpPort);
    await delay(testDelay);
  });

  test("should start IPC server and store port", async () => {
    const storedPort = await getStoredIPCPort(httpPort);
    expect(storedPort).toBe(sharedServer.getPort());
  });

  test("should connect IPC client to server", async () => {
    const ipcClient = new IPCClient();
    try {
      const result = await ipcClient.connect(httpPort);
      expect(result).toBe(ConnectionResult.Connected);
    } finally {
      await ipcClient.close();
    }
  });

  test("should send and receive messages", async () => {
    const ipcClient = new IPCClient();
    try {
      await ipcClient.connect(httpPort);

      const message = { type: "ADD_CONFIG" as 'ADD_CONFIG', pid: process.pid, config: { port: httpPort, paths: [] } as Config };

      const messagePromise = new Promise((resolve) => {
        const messageHandler = (msg: any) => {
          sharedServer.removeListener("message", messageHandler);
          resolve(msg);
        };
        sharedServer.on("message", messageHandler);
      });

      await ipcClient.sendMessage(message);

      const receivedMessage = await messagePromise;

      expect(receivedMessage).toEqual(message);
    } finally {
      await ipcClient.close();
    }
  });

  test("should handle client disconnection", async () => {
    const ipcClient = new IPCClient();
    try {
      await ipcClient.connect(httpPort);
      await ipcClient.close();
      await delay(1000); // Wait for disconnection to be processed

      expect(sharedServer["sockets"].size).toBe(0);
    } finally {
      // Client is already closed
    }
  });
});
