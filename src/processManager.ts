import { serve } from 'bun';
import { Config } from './types';
import { validateConfig } from './configValidator';
import { handleRequest } from './requestHandler';
import { logRequest, logResponse, logger } from './logger';
import { IPCServer, IPCClient, ConnectionResult } from './ipc';
import { clearStoredIPCPort } from './storage';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 333; // 333ms

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
      const connectionResult = await this.ipcClient.connect(config.port);

      switch (connectionResult) {
        case ConnectionResult.Connected:
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

        case ConnectionResult.NoStoredPort:
          // No need to retry, we're the first instance
          logger.debug('No stored port found, starting as first instance');
          return this.startAsFirstInstance(config);

        case ConnectionResult.FailedToConnect:
          if (attempt < MAX_RETRY_ATTEMPTS - 1) {
            logger.debug(`Connection attempt ${attempt + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          } else {
            logger.debug('All connection attempts failed, starting as first instance');
          }
          break;
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
    this.ipcServer = new IPCServer(
      this.handleIPCMessage.bind(this),
      this.handleDisconnect.bind(this),
      config.port
    );
    await this.ipcServer.start();
    logger.info(`IPC server is running at ${this.ipcServer.getPort()}`);

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

  private handleDisconnect(pid: number): void {
    this.removeConfig(pid);
    logger.info(`Client with PID ${pid} disconnected and its configuration removed.`);
  }

  private addConfig(config: Config, pid: number = process.pid): void {
    validateConfig(config);
    this.configs.set(pid, config);
    const processType = pid === process.pid ? "current" : "external";
    logger.info(`Added configuration for ${processType} process (PID ${pid})`);
    logger.debug(`Configuration details:`, config);
  }

  private removeConfig(pid: number): void {
    const config = this.configs.get(pid);
    if (config) {
      this.configs.delete(pid);
      const processType = pid === process.pid ? "current" : "external";
      logger.info(`Removed configuration for ${processType} process (PID ${pid})`);
      logger.debug(`Removed configuration details:`, config);
    } else {
      logger.warn(`Attempted to remove non-existent configuration for PID: ${pid}`);
    }
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
