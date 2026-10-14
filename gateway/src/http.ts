import { Agent, fetch as undiciFetch } from 'undici';
import type { GatewayConfig } from './config.js';

let agent: Agent | null = null;

export function getDispatcher(config: GatewayConfig): Agent {
  if (!agent) {
    agent = new Agent({
      connections: config.httpConnections,
      pipelining: 1,
      keepAliveTimeout: config.httpKeepAliveMs,
      keepAliveMaxTimeout: config.httpKeepAliveMs * 2,
    });
  }
  return agent;
}

export async function closeDispatcher(): Promise<void> {
  if (!agent) return;
  await agent.close();
  agent = null;
}

export interface PooledRequest {
  method: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal;
  duplex?: 'half';
}

export function pooledFetch(config: GatewayConfig, url: string, init: PooledRequest): Promise<Response> {
  return undiciFetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body ?? undefined,
    signal: init.signal,
    duplex: init.duplex,
    dispatcher: getDispatcher(config),
  } as never) as unknown as Promise<Response>;
}
