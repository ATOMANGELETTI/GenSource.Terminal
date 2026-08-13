/**
 * Portable Stronghold vault for the Gemini API key.
 * Snapshot + salt live under other/database/stronghold/ (path from Rust).
 */

import { Stronghold } from "@tauri-apps/plugin-stronghold";

import { agentCacheApiKey, getPortableDataPaths } from "./agent";

const CLIENT_NAME = "gensource.agent";
const API_KEY_RECORD = "gemini.apiKey";

let sessionVault: Stronghold | null = null;

function encodeSecret(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function decodeSecret(bytes: Uint8Array | number[] | null): string {
  if (!bytes || bytes.length === 0) return "";
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new TextDecoder().decode(array);
}

async function clientFor(vault: Stronghold) {
  try {
    return await vault.loadClient(CLIENT_NAME);
  } catch {
    return vault.createClient(CLIENT_NAME);
  }
}

export async function vaultExists(): Promise<boolean> {
  const paths = await getPortableDataPaths();
  return paths.vaultExists;
}

export async function unlockAgentVault(
  password: string,
): Promise<{ apiKey: string; vaultPath: string }> {
  const paths = await getPortableDataPaths();
  const vault = await Stronghold.load(paths.vaultPath, password);
  const client = await clientFor(vault);
  const store = client.getStore();
  const apiKey = decodeSecret(await store.get(API_KEY_RECORD));
  sessionVault = vault;
  if (apiKey) {
    await agentCacheApiKey(apiKey);
  }
  return { apiKey, vaultPath: paths.vaultPath };
}

export async function createAgentVault(
  password: string,
  apiKey: string,
): Promise<void> {
  const paths = await getPortableDataPaths();
  const vault = await Stronghold.load(paths.vaultPath, password);
  const client = await clientFor(vault);
  const store = client.getStore();
  await store.insert(API_KEY_RECORD, encodeSecret(apiKey.trim()));
  await vault.save();
  sessionVault = vault;
  await agentCacheApiKey(apiKey);
}

export async function saveVaultApiKey(apiKey: string): Promise<void> {
  if (!sessionVault) {
    throw new Error("Vault is locked. Unlock it in Config → Agents first.");
  }
  const client = await clientFor(sessionVault);
  const store = client.getStore();
  await store.insert(API_KEY_RECORD, encodeSecret(apiKey.trim()));
  await sessionVault.save();
  await agentCacheApiKey(apiKey);
}

export function isAgentVaultUnlocked(): boolean {
  return sessionVault !== null;
}

export function lockAgentVaultSession(): void {
  sessionVault = null;
}
