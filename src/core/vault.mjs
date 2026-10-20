import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const providers = new Set(['openai', 'gemini', 'grok', 'deepseek', 'local']);

/** OS-backed credentials only. Never fall back to plaintext persistence. */
export class CredentialVault {
  #directory;
  #safeStorage;
  #platform;
  #memory = new Map();
  constructor(directory, safeStorage, platform = process.platform) {
    this.#directory = directory;
    this.#safeStorage = safeStorage;
    this.#platform = platform;
  }
  get persistent() {
    return Boolean(this.#safeStorage?.isEncryptionAvailable()) &&
      !(this.#platform === 'linux' && this.#safeStorage.getSelectedStorageBackend?.() === 'basic_text');
  }
  #file(provider) {
    if (!providers.has(provider)) throw new Error('Unknown model provider.');
    return path.join(this.#directory, `${provider}.bin`);
  }
  async get(provider) {
    const file = this.#file(provider);
    if (this.#memory.has(provider)) return this.#memory.get(provider);
    if (!this.persistent) return '';
    try {
      const buffer = await readFile(file);
      const value = this.#safeStorage.decryptString(buffer);
      this.#memory.set(provider, value);
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return '';
      throw new Error('The saved model credential could not be unlocked. Enter it again in Settings.');
    }
  }
  async save(provider, key) {
    const file = this.#file(provider);
    if (typeof key !== 'string' || key.length > 4096 || /[\r\n\0]/.test(key)) throw new Error('Invalid API key.');
    key = key.trim();
    if (!key) {
      this.#memory.delete(provider);
      await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
      return { stored: false, persistent: this.persistent };
    }
    this.#memory.set(provider, key);
    if (!this.persistent) {
      // Remove stale encrypted state so a future unlock cannot resurrect an old key.
      await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
      return { stored: true, persistent: false };
    }
    await mkdir(this.#directory, { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, this.#safeStorage.encryptString(key), { mode: 0o600, flag: 'wx' });
      await rename(temporary, file);
    } finally { await unlink(temporary).catch(() => {}); }
    return { stored: true, persistent: true };
  }
  async status() {
    const result = {};
    for (const provider of providers) {
      try { result[provider] = Boolean(await this.get(provider)); }
      catch { result[provider] = false; }
    }
    return result;
  }
  redact(message) {
    let text = String(message ?? 'Operation failed.');
    for (const value of this.#memory.values()) if (value) text = text.split(value).join('[redacted]');
    return text.replace(/(authorization|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 300);
  }
}
