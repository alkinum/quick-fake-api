import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import { Config } from "./types";
import { storeIPCPort, getStoredIPCPort, clearStoredIPCPort } from "./storage";
import { logger } from './logger';

const IPC_PORT_RANGE_START = 49152;
const IPC_PORT_RANGE_END = 65535;
const MAX_RETRIES = 10;

function getRandomPort(start: number, end: number): number {
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

async function findAvailablePort(start: number, end: number): Promise<number> {
  const randomStart = getRandomPort(start, end);
  for (let i = 0; i < end - start + 1; i++) {
    const port = (randomStart + i - start) % (end - start + 1) + start;
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

export type Message = {
  type: "ADD_CONFIG" | "REMOVE_CONFIG";
  pid: number;
  config?: Config;
};

export class IPCServer {
  private server: net.Server;
  private port: number | null = null;
  private sockets: Map<net.Socket, number> = new Map(); // Changed to Map, storing socket and PID
  private httpPort: number;
  private connectionTimeouts: Map<number, ReturnType<typeof setTimeout>> = new Map(); // New: storing PID and timeout timer
  private readonly RECONNECT_TIMEOUT = 5000; // 5 seconds reconnection timeout

  constructor(private onMessage: (message: Message) => void, private onDisconnect: (pid: number) => void, httpPort: number) {
    this.httpPort = httpPort;
    this.server = net.createServer((socket) => {
      socket.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString()) as Message;
          this.onMessage(message);
          this.sockets.set(socket, message.pid); // Store socket and PID mapping
          this.clearConnectionTimeout(message.pid); // Clear reconnection timeout
        } catch (err) {
          logger.error('Error parsing IPC message:', err);
        }
      });
      socket.on('close', () => {
        const pid = this.sockets.get(socket);
        if (pid) {
          this.setConnectionTimeout(pid);
        }
        this.sockets.delete(socket);
      });
    });
  }

  private setConnectionTimeout(pid: number) {
    const timeout = setTimeout(() => {
      this.onDisconnect(pid);
      this.connectionTimeouts.delete(pid);
    }, this.RECONNECT_TIMEOUT);
    this.connectionTimeouts.set(pid, timeout);
  }

  private clearConnectionTimeout(pid: number) {
    const timeout = this.connectionTimeouts.get(pid);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(pid);
    }
  }

  async start(): Promise<void> {
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        this.port = await findAvailablePort(IPC_PORT_RANGE_START, IPC_PORT_RANGE_END);
        await new Promise<void>((resolve, reject) => {
          // @ts-ignore
          this.server.listen(this.port, '127.0.0.1', () => {
            logger.debug(`IPC server listening on 127.0.0.1:${this.port}`);
            resolve();
          });
          this.server.on('error', reject);
        });
        await storeIPCPort(this.httpPort, this.port); // Store the port after successful start
        return; // Successfully started, exit the loop
      } catch (err) {
        logger.error(`Failed to start IPC server (attempt ${i + 1}/${MAX_RETRIES}):`, err);
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
    for (const socket of this.sockets) {
      socket[0].destroy();
    }
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    await clearStoredIPCPort(this.httpPort); // Clear the stored port when closing the server
    logger.debug(`IPC server closed and port cleared for HTTP port ${this.httpPort}`);
  }
}

export enum ConnectionResult {
  Connected,
  NoStoredPort,
  FailedToConnect
}

export class IPCClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private httpPort: number | null = null;
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private hasEverConnected: boolean = false;

  async connect(httpPort: number): Promise<ConnectionResult> {
    this.httpPort = httpPort;
    const result = await this.attemptConnection();
    if (result === ConnectionResult.Connected) {
      this.hasEverConnected = true;
    }
    return result;
  }

  private async attemptConnection(): Promise<ConnectionResult> {
    const storedPort = await getStoredIPCPort(this.httpPort!);
    if (!storedPort) {
      return ConnectionResult.NoStoredPort;
    }

    try {
      await this.connectToPort(storedPort);
      logger.debug(`Successfully connected to IPC server on port ${storedPort}`);
      this.reconnectAttempts = 0;
      return ConnectionResult.Connected;
    } catch (err) {
      logger.debug(`Failed to connect to stored port ${storedPort}`);
      return ConnectionResult.FailedToConnect;
    }
  }

  private connectToPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.connect(port, '127.0.0.1', () => {
        this.setupSocketListeners();
        resolve();
      });
      this.socket.on('error', (err) => {
        this.socket?.destroy();
        this.socket = null;
        reject(err);
      });
    });
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('close', () => {
      this.emit('close');
      if (this.hasEverConnected) {
        this.attemptReconnect();
      }
    });

    this.socket.on('error', (error) => {
      logger.error('Socket error:', error);
      if (this.hasEverConnected) {
        this.attemptReconnect();
      }
    });
  }

  private async attemptReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    logger.info(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    try {
      const result = await this.attemptConnection();
      if (result === ConnectionResult.Connected) {
        logger.info('Reconnected successfully');
        this.isReconnecting = false;
        this.emit('reconnect');
      } else {
        throw new Error('Reconnection failed');
      }
    } catch (error) {
      logger.error('Reconnection attempt failed:', error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.attemptReconnect(), this.reconnectDelay);
      } else {
        logger.error('Max reconnection attempts reached. Giving up.');
        this.isReconnecting = false;
        this.emit('reconnectFailed');
      }
    }
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
      this.socket = null;
    }
  }
}
