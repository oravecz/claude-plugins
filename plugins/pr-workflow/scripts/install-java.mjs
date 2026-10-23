#!/usr/bin/env node
import { constants } from 'node:fs';
import { access, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { download, fetchJson, fetchText, installRelease, platform, run } from './download.mjs';

const milestones = 'https://download.eclipse.org/jdtls/milestones/';
const adoptium = 'https://api.adoptium.net/v3';

function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

async function install() {
  const { os, arch } = platform();
  const index = await fetchText(milestones);
  const versions = [...index.matchAll(/href\s*=\s*['"](?:https:\/\/download\.eclipse\.org)?\/jdtls\/milestones\/(\d+\.\d+\.\d+)\/?['"]/gi)]
    .map(match => match[1]);
  versions.sort(compareVersions);
  const version = versions.at(-1);
  if (!version) throw new Error('No stable JDT LS milestone found in the Eclipse index.');

  const releaseUrl = `${milestones}${version}/`;
  const filename = (await fetchText(`${releaseUrl}latest.txt`)).trim();
  const archiveVersion = /^jdt-language-server-(\d+\.\d+\.\d+)-\d+\.tar\.gz$/.exec(filename);
  if (!archiveVersion || archiveVersion[1] !== version) {
    throw new Error(`Unexpected JDT LS archive filename: ${filename}`);
  }
  const checksumText = (await fetchText(`${releaseUrl}${filename}.sha256`)).trim();
  const checksum = /^([a-f0-9]{64})(?:\s|$)/i.exec(checksumText)?.[1].toLowerCase();
  if (!checksum) throw new Error('Eclipse returned an invalid JDT LS SHA-256 checksum.');

  const releases = await fetchJson(`${adoptium}/info/available_releases`);
  const lts = releases.most_recent_lts;
  if (!Number.isSafeInteger(lts) || lts < 1) throw new Error('Adoptium returned an invalid latest LTS version.');
  const jdkOs = os === 'macos' ? 'mac' : 'linux';
  const jdkArch = arch === 'arm64' ? 'aarch64' : 'x64';
  const assets = await fetchJson(`${adoptium}/assets/latest/${lts}/hotspot?architecture=${jdkArch}&image_type=jdk&os=${jdkOs}&vendor=eclipse`);
  const candidates = Array.isArray(assets) ? assets.filter(asset =>
    asset.binary?.architecture === jdkArch && asset.binary?.os === jdkOs &&
    asset.binary?.image_type === 'jdk' && asset.binary?.jvm_impl === 'hotspot' &&
    asset.binary?.heap_size === 'normal' && asset.vendor === 'eclipse'
  ) : [];
  if (candidates.length !== 1) throw new Error(`Expected one latest Temurin ${lts} JDK archive for ${os}/${arch}.`);
  const jdkPackage = candidates[0].binary.package;
  if (!jdkPackage || !/^[a-f0-9]{64}$/i.test(jdkPackage.checksum) ||
      typeof jdkPackage.link !== 'string' || !jdkPackage.link.startsWith('https://') ||
      !jdkPackage.link.endsWith('.tar.gz')) {
    throw new Error('Adoptium returned invalid JDK archive metadata.');
  }
  const jdkChecksum = jdkPackage.checksum.toLowerCase();
  const key = `jdtls-${version}-${checksum}-jdk-${lts}-${jdkChecksum}-${os}-${arch}`;
  const current = await installRelease('java-lsp', key, async stage => {
    const server = join(stage, 'jdtls');
    const unpackedJdk = join(stage, 'jdk-unpacked');
    const serverArchive = join(stage, 'jdtls.tar.gz');
    const jdkArchive = join(stage, 'jdk.tar.gz');
    await mkdir(server);
    await mkdir(unpackedJdk);
    await download(`${releaseUrl}${filename}`, serverArchive, checksum);
    await download(jdkPackage.link, jdkArchive, jdkChecksum);
    run('tar', ['-xzf', serverArchive, '-C', server]);
    run('tar', ['-xzf', jdkArchive, '-C', unpackedJdk]);

    const roots = await readdir(unpackedJdk, { withFileTypes: true });
    if (roots.length !== 1 || !roots[0].isDirectory()) {
      throw new Error('Expected one enclosing directory in the Temurin JDK archive.');
    }
    const root = join(unpackedJdk, roots[0].name);
    const home = os === 'macos' ? join(root, 'Contents', 'Home') : root;
    await rename(home, join(stage, 'jdk'));
    const launcher = join(server, 'bin', 'jdtls');
    const java = join(stage, 'jdk', 'bin', 'java');
    if (!(await stat(launcher)).isFile() || !(await stat(java)).isFile()) {
      throw new Error('The downloaded Java language server or JDK is missing its launcher.');
    }
    await access(launcher, constants.R_OK);
    await access(java, constants.X_OK);
    await rm(serverArchive);
    await rm(jdkArchive);
    await rm(unpackedJdk, { recursive: true });
  });
  console.log(`Java language server: JDT LS ${version}, Temurin LTS ${lts} (${current})`);
}

install().catch(error => {
  console.error(`Java language server installation failed: ${error.message}`);
  process.exitCode = 1;
});
