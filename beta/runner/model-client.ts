import { readFile } from 'node:fs/promises';
import type { CompletionInput, ModelClient } from './types.js';

/** Stateless requests: no shared conversation, tools, persisted response, or filesystem access. */
export class OpenAIClient implements ModelClient {
  constructor(private readonly config: {apiKey: string; model: string; baseUrl?: string; timeoutMs?: number}, private readonly transport: typeof fetch = fetch) {
    if (!config.apiKey || !config.model) throw new Error('OPENAI_API_KEY and BETA_MODEL are required. No simulated AI fallback is allowed.');
    const url = new URL(config.baseUrl ?? 'https://api.openai.com/v1');
    if (url.protocol !== 'https:' || url.hostname !== 'api.openai.com' || url.username || url.password || url.search || url.hash) {
      throw new Error('This OpenAI runner only sends credentials to https://api.openai.com.');
    }
  }
  async complete({system, prompt, images, format = 'json'}: CompletionInput): Promise<string> {
    const content: unknown[] = [{type:'input_text',text:prompt}];
    for (const path of images ?? []) {
      if (!/\.png$/i.test(path)) throw new Error('Reviewer images must be recorded PNG screenshots');
      content.push({type:'input_image',image_url:`data:image/png;base64,${(await readFile(path)).toString('base64')}`,detail:'auto'});
    }
    const response = await this.transport(`${(this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
      method: 'POST', headers: {'Authorization': `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json'},
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 25_000),
      body: JSON.stringify({model: this.config.model, store: false, tools: [],
        instructions: format === 'json' ? `${system}\nReturn exactly one JSON object.` : system, input: images?.length ? [{role:'user',content}] : prompt,
        text: {format: {type: format === 'json' ? 'json_object' : 'text'}}, max_output_tokens: format === 'json' ? 6000 : 12000}),
    });
    // Never log response headers, API keys, or arbitrary provider error bodies.
    if (!response.ok) throw new Error(`OpenAI request failed: HTTP ${response.status}`);
    const body = await response.json() as {status?: string; output?: {type: string; content?: {type: string; text?: string}[]}[]};
    if (body.status !== 'completed') throw new Error(`OpenAI response did not complete (${body.status ?? 'unknown'}).`);
    const text = (body.output ?? []).filter(item => item.type === 'message').flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('');
    if (!text) throw new Error('OpenAI returned no text.');
    return text;
  }
}
