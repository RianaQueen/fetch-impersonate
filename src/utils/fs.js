import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function curFilePath(importMeta) {
  const __filename = fileURLToPath(importMeta.url);
  return __filename;
}

export function curDirPath(importMeta) {
  const filePath = curFilePath(importMeta);
  const __dirname = path.dirname(filePath);
  return __dirname;
}
