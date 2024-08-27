import { serve } from 'bun';
import { Config } from './types';
import { validateConfig } from './configValidator';
import { handleRequest } from './requestHandler';
import { logRequest, logResponse, logger } from './logger';
import { IPCServer, IPCClient } from './ipc';

class ProcessManager {
  private static instance: ProcessManager;
  private configs: Map<number, Config> = new Map();
  private server: ReturnType<typeof serve> | null = null;
  private ipcServer: IPCServer | null = null;
  private ipcClient: IPCClient | null = null;
  private port: number | null = null;

  private constructor() {}

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  async start(config: Config): Promise<boolean> {
    // Check if this is the first instance by attempting to connect to IPC server
    const tempClient = new IPCClient();
    const isConnected = await tempClient.connect();
    tempClient.close();

    if (isConnected) {
      // Another instance is already running
      this.ipcClient = new IPCClient();
      await this.ipcClient.connect();
      this.ipcClient.sendMessage({
        type: "ADD_CONFIG",
        pid: process.pid,
        config,
      });
      return false;
    }

    // This is the first instance, start the server
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

    this.ipcServer = new IPCServer(this.handleIPCMessage.bind(this));

    logger.log('INFO', `Server running at http://${config.host || "localhost"}:${this.port}`);
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
    logger.log('INFO', `Added configuration for PID ${pid}`);
  }

  removeConfig(pid: number): void {
    this.configs.delete(pid);
    logger.log('WARN', `Removed configuration for PID ${pid}`);
  }

  private findPathConfig(pathname: string) {
    for (const config of this.configs.values()) {
      const pathConfig = config.paths.find((p) => pathname === p.path);
      if (pathConfig) return pathConfig;
    }
    return null;
  }

  shutdown(): void {
    if (this.ipcClient) {
      this.ipcClient.sendMessage({
        type: "REMOVE_CONFIG",
        pid: process.pid,
      });
      this.ipcClient.close();
    }
    if (this.ipcServer) {
      this.ipcServer.close();
    }
    if (this.server) {
      this.server.stop();
    }
  }
}

export const processManager = ProcessManager.getInstance();
