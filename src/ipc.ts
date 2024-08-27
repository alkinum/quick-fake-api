import * as net from 'node:net';
import { Config } from "./types";
import { storeIPCPort, getStoredIPCPort, clearStoredIPCPort } from "./storage";
import { logger } from './logger';

const IPC_PORT_RANGE_START = 49152;
const IPC_PORT_RANGE_END = 65535;
const MAX_RETRIES = 10;

export type Message = {
  type: "ADD_CONFIG" | "REMOVE_CONFIG";
  pid: number;
  config?: Config;
};

async function findAvailablePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = net.createServer();
        server.listen(port, '127.0.0.1', () => {
          server.close(() => resolve());
        });
        server.on('error', reject);
      });
      return port;
    } catch {
      // Port is not available, continue to next
    }
  }
  throw new Error(`No available ports found in range ${start}-${end}`);
}

export class IPCServer {
  private server: net.Server;
  private port: number | null = null;

  constructor(private onMessage: (message: Message) => void) {
    this.server = net.createServer((socket) => {
      socket.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString()) as Message;
          this.onMessage(message);
        } catch (err) {
          logger.log('ERROR', 'Error parsing IPC message:', err);
        }
      });
    });
  }

  async start(): Promise<void> {
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        this.port = await findAvailablePort(IPC_PORT_RANGE_START, IPC_PORT_RANGE_END);
        await new Promise<void>((resolve, reject) => {
          // @ts-ignore
          this.server.listen(this.port, '127.0.0.1', () => {
            logger.log('DEBUG', `IPC server listening on 127.0.0.1:${this.port}`);
            resolve();
          });
          this.server.on('error', reject);
        });
        await storeIPCPort(this.port); // Store the port after successful start
        return; // Successfully started, exit the loop
      } catch (err) {
        logger.log('ERROR', `Failed to start IPC server (attempt ${i + 1}/${MAX_RETRIES}):`, err);
        if (i === MAX_RETRIES - 1) {
          throw new Error('Failed to start IPC server after multiple attempts');
        }
      }
    }
  }

  getPort(): number {
    if (this.port === null) {
      throw new Error('IPC server has not been started');
    }
    return this.port;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    await clearStoredIPCPort(); // Clear the stored port when closing the server
    logger.log('DEBUG', 'IPC server closed and port cleared');
  }
}

export class IPCClient {
  private socket: net.Socket | null = null;

  async connect(): Promise<boolean> {
    // First, try to get the stored port
    const storedPort = await getStoredIPCPort();
    if (storedPort !== null) {
      try {
        await this.connectToPort(storedPort);
        logger.log('DEBUG', `Connected to IPC server on stored port ${storedPort}`);
        return true;
      } catch (err) {
        logger.log('DEBUG', `Failed to connect to stored port ${storedPort}, trying other ports...`);
      }
    }
    logger.log('DEBUG', 'Failed to connect to IPC server');
    return false;
  }

  private connectToPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.connect(port, '127.0.0.1', () => resolve());
      this.socket.on('error', (err) => {
        this.socket?.destroy();
        this.socket = null;
        reject(err);
      });
    });
  }

  async sendMessage(message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.write(JSON.stringify(message), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close(): void {
    if (this.socket) {
      this.socket.destroy();
    }
  }
}

export async function initializeIPC(): Promise<number> {
  const server = new IPCServer(() => {}); // Dummy message handler
  await server.start();
  const port = server.getPort();
  await server.close();
  return port;
}