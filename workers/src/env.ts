import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createDeepSeekProvider, createGeminiProvider } from './providers/index.js';
import type { EmbeddingConfig, EmbeddingProvider } from './providers/types.js';

export type EmbeddingProviderName = 'deepseek' | 'gemini';

export interface WorkerEnv {
  EMBEDDING_PROVIDER: EmbeddingProviderName;
  EMBEDDING_DIMENSIONS?: number;
  DEEPSEEK_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

export interface EmbeddingRuntime {
  embeddingProvider: EmbeddingProvider;
  embeddingConfig: EmbeddingConfig;
}

/**
 * Parse and validate worker environment variables. The worker fails fast so a
 * misconfigured embedding provider never makes it into queue processing.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const resolved = loadWorkerEnv(source);
  const provider = resolved.EMBEDDING_PROVIDER?.trim().toLowerCase() ?? 'deepseek';

  if (provider !== 'deepseek' && provider !== 'gemini') {
    throw new Error(
      `Invalid environment variables:\n  - EMBEDDING_PROVIDER: must be one of "deepseek" or "gemini"`,
    );
  }

  if (provider === 'deepseek' && !hasValue(resolved.DEEPSEEK_API_KEY)) {
    throw new Error(
      `Invalid environment variables:\n  - DEEPSEEK_API_KEY: is required when EMBEDDING_PROVIDER=deepseek`,
    );
  }

  if (provider === 'gemini' && !hasValue(resolved.GEMINI_API_KEY)) {
    throw new Error(
      `Invalid environment variables:\n  - GEMINI_API_KEY: is required when EMBEDDING_PROVIDER=gemini`,
    );
  }

  return {
    EMBEDDING_PROVIDER: provider,
    EMBEDDING_DIMENSIONS: resolved.EMBEDDING_DIMENSIONS
      ? Number.parseInt(resolved.EMBEDDING_DIMENSIONS, 10)
      : undefined,
    DEEPSEEK_API_KEY: normalize(resolved.DEEPSEEK_API_KEY),
    GEMINI_API_KEY: normalize(resolved.GEMINI_API_KEY),
  };
}

export function createEmbeddingRuntime(
  source: Record<string, string | undefined> = process.env,
): EmbeddingRuntime {
  const env = parseEnv(source);

  if (env.EMBEDDING_PROVIDER === 'deepseek') {
    return {
      embeddingProvider: createDeepSeekProvider(),
      embeddingConfig: { apiKey: env.DEEPSEEK_API_KEY!, dimensions: env.EMBEDDING_DIMENSIONS },
    };
  }

  return {
    embeddingProvider: createGeminiProvider(),
    embeddingConfig: { apiKey: env.GEMINI_API_KEY!, dimensions: env.EMBEDDING_DIMENSIONS },
  };
}

function hasValue(value: string | undefined): boolean {
  return normalize(value) !== undefined;
}

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function loadWorkerEnv(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const fileEnv = loadEnvFiles();
  return { ...fileEnv, ...source };
}

function loadEnvFiles(): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const filePath of candidateEnvFiles()) {
    if (!existsSync(filePath)) continue;
    Object.assign(merged, parseDotEnv(readFileSync(filePath, 'utf8')));
  }

  return merged;
}

function candidateEnvFiles(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, 'workers/.env'),
    path.resolve(cwd, '../.env'),
  ];
}

function parseDotEnv(contents: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}
