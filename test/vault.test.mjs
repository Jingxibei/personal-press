import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CredentialVault } from '../src/core/vault.mjs';

const protectedStore = {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  // This is an injected test double, not a production cryptographic algorithm.
  encryptString: value => Buffer.from([...Buffer.from(value)].map(byte => byte ^ 0x91)),
  decryptString: bytes => Buffer.from([...bytes].map(byte => byte ^ 0x91)).toString(),
};

test('credentials survive an OS-backed restart without plaintext; deletion and IPC status expose no key', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'press-vault-'));
  try {
    const first = new CredentialVault(directory, protectedStore, 'linux');
    const key = 'example-test-credential';
    assert.deepEqual(await first.save('openai', key), { stored:true, persistent:true });
    assert.equal((await readFile(path.join(directory, 'openai.bin'))).includes(Buffer.from(key)), false);
    const restarted = new CredentialVault(directory, protectedStore, 'linux');
    assert.equal(await restarted.get('openai'), key);
    assert.equal((await restarted.status()).openai, true);
    assert.equal(restarted.redact(`Request failed with ${key}`), 'Request failed with [redacted]');
    await restarted.save('openai', '');
    assert.equal(await new CredentialVault(directory, protectedStore, 'linux').get('openai'), '');
    assert.deepEqual(await readdir(directory), []);
    await assert.rejects(first.save('../outside', key), /Unknown model provider/);
  } finally { await rm(directory, { recursive:true, force:true }); }
});

test('Linux basic_text and unavailable keychains use session memory only and remove stale disk secrets', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'press-vault-'));
  try {
    await new CredentialVault(directory, protectedStore, 'linux').save('deepseek', 'old-test-key');
    for (const backend of [
      { ...protectedStore, getSelectedStorageBackend: () => 'basic_text' },
      { ...protectedStore, isEncryptionAvailable: () => false },
    ]) {
      const vault = new CredentialVault(directory, backend, 'linux');
      assert.equal(vault.persistent, false);
      assert.deepEqual(await vault.save('deepseek', 'session-test-key'), { stored:true, persistent:false });
      assert.equal(await vault.get('deepseek'), 'session-test-key');
      assert.deepEqual(await readdir(directory), []);
      assert.equal(await new CredentialVault(directory, backend, 'linux').get('deepseek'), '');
    }
  } finally { await rm(directory, { recursive:true, force:true }); }
});
