import { join } from "node:path";
import { tmpdir } from "node:os";

import { logger } from './logger';

const TMP_DIR = tmpdir();

function getIPCPortFileName(httpPort: number): string {
  return `ipc-port-${httpPort}.tmp`;
}

export async function storeIPCPort(httpPort: number, ipcPort: number): Promise<void> {
  try {
    const fileName = getIPCPortFileName(httpPort);
    const filePath = join(TMP_DIR, fileName);
    await Bun.write(filePath, ipcPort.toString());
    logger.debug(`Storing IPC port ${ipcPort} for HTTP port ${httpPort} at ${filePath}`);
  } catch (error) {
    logger.error("Error storing IPC port:", error);
    throw error;
  }
}

export async function getStoredIPCPort(httpPort: number): Promise<number | null> {
  try {
    const fileName = getIPCPortFileName(httpPort);
    const filePath = join(TMP_DIR, fileName);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const portString = await file.text();
      if (!portString) {
        logger.debug(`File exists but is empty for HTTP port ${httpPort}`);
        return null;
      }
      const port = parseInt(portString, 10);
      logger.debug(`Retrieved IPC port ${port} for HTTP port ${httpPort}`);
      return port;
    }
    logger.debug(`No stored IPC port found for HTTP port ${httpPort}`);
    return null;
  } catch (error) {
    logger.error("Error reading stored IPC port:", error);
    throw error;
  }
}

export async function clearStoredIPCPort(httpPort: number): Promise<void> {
  try {
    const fileName = getIPCPortFileName(httpPort);
    const filePath = join(TMP_DIR, fileName);
    await Bun.write(filePath, ''); // Overwrite with empty string
    logger.debug(`Successfully cleared stored IPC port for HTTP port ${httpPort}`);
  } catch (error) {
    logger.error("Error clearing stored IPC port:", error);
    throw error;
  }
}
