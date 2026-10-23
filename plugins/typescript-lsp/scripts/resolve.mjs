import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const project = resolve(process.argv[2] || process.cwd());
const tools = join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oravecz', 'typescript-lsp');
let packagePath;
try {
  // Normal Node resolution includes workspace/ancestor-hoisted dependencies.
  packagePath = createRequire(join(project, 'package.json')).resolve('typescript/package.json');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  packagePath = join(tools, 'node_modules', 'typescript', 'package.json');
}

const typescript = JSON.parse(readFileSync(packagePath, 'utf8'));
const major = Number.parseInt(typescript.version, 10);
if (!Number.isInteger(major)) throw new Error(`Invalid TypeScript version in ${packagePath}`);
const native = major >= 7;
const entry = native
  ? resolve(dirname(packagePath), typescript.bin.tsc)
  : join(tools, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs');
if (!existsSync(entry)) throw new Error(`Missing LSP runtime: ${entry}. Rerun install.sh and select TypeScript.`);

// Captured by start.sh, never emitted on the LSP protocol stream.
console.log(`${native ? 'native' : 'legacy'}:${entry}`);
