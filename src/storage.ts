import { join } from "node:path";
import { tmpdir } from "node:os";

import { logger } from './logger';

const TMP_DIR = tmpdir();
const IPC_PORT_FILE = "ipc-port.tmp";

export async function storeIPCPort(port: number): Promise<void> {
  try {
    const filePath = join(TMP_DIR, IPC_PORT_FILE);
    await Bun.write(filePath, port.toString());
  } catch (error) {
    logger.log('ERROR', "Error storing IPC port:", error);
    throw error;
  }
}

export async function getStoredIPCPort(): Promise<number | null> {
  try {
    const filePath = join(TMP_DIR, IPC_PORT_FILE);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const portString = await file.text();
      return parseInt(portString, 10);
    }
    return null;
  } catch (error) {
    logger.log('ERROR', "Error reading stored IPC port:", error);
    throw error;
  }
}

export async function clearStoredIPCPort(): Promise<void> {
  try {
    const filePath = join(TMP_DIR, IPC_PORT_FILE);
    await Bun.write(filePath, ''); // Overwrite with empty string
  } catch (error) {
    logger.log('ERROR', "Error clearing stored IPC port:", error);
    throw error;
  }
}
