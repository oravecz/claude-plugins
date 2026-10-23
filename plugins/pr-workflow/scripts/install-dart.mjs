#!/usr/bin/env node
import { constants } from 'node:fs';
import { access, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { download, fetchJson, fetchText, installRelease, platform, run } from './download.mjs';

const { os, arch } = platform();
const archiveRoot = 'https://storage.googleapis.com/dart-archive/channels/stable/release';
const { version } = await fetchJson(`${archiveRoot}/latest/VERSION`);
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Dart stable release metadata contains an invalid version');
}
const filename = `dartsdk-${os}-${arch}-release.zip`;
const url = `${archiveRoot}/${version}/sdk/${filename}`;
const checksum = (await fetchText(`${url}.sha256sum`)).trim().split(/\s+/)[0];
if (!/^[a-fA-F0-9]{64}$/.test(checksum)) {
  throw new Error('Dart archive metadata contains an invalid SHA-256 checksum');
}
const sha256 = checksum.toLowerCase();
const releaseKey = `${version}-${os}-${arch}-${sha256}`;
const current = await installRelease('dart-lsp', releaseKey, async (stageDir) => {
  const archive = join(stageDir, filename);
  await download(url, archive, sha256);
  run('unzip', ['-q', archive, '-d', stageDir]);
  await rm(archive);
  const executable = join(stageDir, 'dart-sdk', 'bin', 'dart');
  if (!(await stat(executable)).isFile()) {
    throw new Error('Dart archive does not contain a Dart executable');
  }
  await access(executable, constants.X_OK);
});
console.log(`Dart ${version} installed at ${current}`);
