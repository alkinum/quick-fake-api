import { serve } from 'bun';
import { Config } from './types';
import { validateConfig } from './configValidator';
import { handleRequest } from './requestHandler';
import { logRequest, logResponse, logger } from './logger';
import { IPCServer, IPCClient } from './ipc';
import { clearStoredIPCPort } from './storage';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

class ProcessManager {
  private static instance: ProcessManager;
  private configs: Map<number, Config> = new Map();
  private server: ReturnType<typeof serve> | null = null;
  private ipcServer: IPCServer | null = null;
  private ipcClient: IPCClient | null = null;
  private port: number | null = null;
  private existingInstanceClosedPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  async start(config: Config): Promise<boolean> {
    this.ipcClient = new IPCClient();

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      const isConnected = await this.ipcClient.connect(config.port);
      if (isConnected) {
        // Other instance is running
        await this.ipcClient.sendMessage({
          type: "ADD_CONFIG",
          pid: process.pid,
          config,
        });
        this.existingInstanceClosedPromise = new Promise<void>((resolve) => {
          this.ipcClient!.on('close', () => {
            resolve();
          });
        });
        return false;
      }

      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    this.ipcClient.close();
    this.ipcClient = null;

    await clearStoredIPCPort(config.port);

    return this.startAsFirstInstance(config);
  }

  async waitForExistingInstanceToClose(): Promise<void> {
    if (this.existingInstanceClosedPromise) {
      await this.existingInstanceClosedPromise;
      this.existingInstanceClosedPromise = null;
    }
  }

  private async startAsFirstInstance(config: Config): Promise<boolean> {
    this.ipcServer = new IPCServer(this.handleIPCMessage.bind(this), config.port);
    await this.ipcServer.start();

    this.port = config.port;
    this.configs.clear();
    this.addConfig(config);

    this.server = serve({
      port: this.port,
      hostname: config.host,
      fetch: async (req) => {
        const loggedReq = await logRequest(req);
        const url = new URL(req.url);
        const pathConfig = this.findPathConfig(url.pathname);
        if (!pathConfig) {
          return new Response("Not Found", { status: 404 });
        }
        const response = await handleRequest(loggedReq, pathConfig);
        logResponse(response);
        return response;
      },
    });

    logger.info(`Http server is running at http://${config.host || "localhost"}:${this.port}`);

    await this.ipcServer.start();
    logger.info(`IPC server is running at ${this.ipcServer.getPort()}`);

    return true;
  }

  private handleIPCMessage(message: {
    type: string;
    pid: number;
    config?: Config;
  }): void {
    switch (message.type) {
      case "ADD_CONFIG":
        if (message.config) {
          this.addConfig(message.config, message.pid);
        }
        break;
      case "REMOVE_CONFIG":
        this.removeConfig(message.pid);
        break;
    }
  }

  private addConfig(config: Config, pid: number = process.pid): void {
    validateConfig(config);
    this.configs.set(pid, config);
    logger.info(`Added configuration for PID ${pid}`);
  }

  removeConfig(pid: number): void {
    this.configs.delete(pid);
    logger.info(`Removed configuration for PID ${pid}`);
  }

  private findPathConfig(pathname: string) {
    for (const config of this.configs.values()) {
      const pathConfig = config.paths.find((p) => pathname === p.path);
      if (pathConfig) return pathConfig;
    }
    return null;
  }

  async shutdown(): Promise<void> {
    if (this.ipcClient) {
      await this.ipcClient.sendMessage({
        type: "REMOVE_CONFIG",
        pid: process.pid,
      });
      this.ipcClient.close();
    }
    if (this.ipcServer) {
      await this.ipcServer.close();
    }
    if (this.server) {
      this.server.stop();
    }
    logger.info('Process manager shutdown complete');
  }
}

export const processManager = ProcessManager.getInstance();
