import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function platform() {
  const os = { darwin: 'macos', linux: 'linux' }[process.platform];
  const arch = { arm64: 'arm64', x64: 'x64' }[process.arch];
  if (!os || !arch) throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`);
  return { os, arch };
}

async function response(url) {
  if (!url.startsWith('https://')) throw new Error(`Expected an HTTPS download: ${url}`);
  const result = await fetch(url);
  if (!result.ok) throw new Error(`Download failed (${result.status}): ${url}`);
  if (!result.url.startsWith('https://')) throw new Error(`Insecure redirect: ${result.url}`);
  return result;
}

export async function fetchText(url) {
  return (await response(url)).text();
}

export async function fetchJson(url) {
  return (await response(url)).json();
}

export async function download(url, destination, sha256) {
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error(`Invalid upstream SHA-256 for ${url}`);
  console.log(`Downloading ${url}`);
  const result = await response(url);
  const hash = createHash('sha256');
  await pipeline(
    Readable.fromWeb(result.body),
    async function* hashChunks(source) {
      for await (const chunk of source) {
        hash.update(chunk);
        yield chunk;
      }
    },
    createWriteStream(destination, { flags: 'wx' }),
  );
  if (hash.digest('hex') !== sha256.toLowerCase()) throw new Error(`SHA-256 mismatch: ${url}`);
}

export function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal || result.status})`);
}

export async function installRelease(service, release, prepare) {
  if (!/^[a-z0-9-]+$/.test(service) || !/^[a-zA-Z0-9._+-]+$/.test(release)) {
    throw new Error('Invalid managed release directory name');
  }
  const base = join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'oravecz', service);
  const releases = join(base, 'releases');
  const target = join(releases, release);
  await mkdir(releases, { recursive: true });
  let installed = false;
  try {
    await access(join(target, '.complete'));
    installed = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!installed) {
    const stage = await mkdtemp(join(base, '.install-'));
    try {
      await prepare(stage);
      await writeFile(join(stage, '.complete'), `${release}\n`);
      await rename(stage, target);
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }
  // Keep running servers on their immutable release; activate only a complete one.
  const link = join(base, `.current-${randomUUID()}`);
  try {
    await symlink(join('releases', release), link);
    await rename(link, join(base, 'current'));
  } finally {
    await rm(link, { force: true });
  }
  console.log(`${service}: ${release}${installed ? ' (already current)' : ' installed'}`);
  return join(base, 'current');
}
