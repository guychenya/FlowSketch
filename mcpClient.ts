
import { MCPSettings, FlowHubFlow } from './types';

export class FlowHubClient {
  private settings: MCPSettings;

  constructor(settings: MCPSettings) {
    this.settings = settings;
  }

  private async request(method: string, params: any = {}) {
    const response = await fetch(this.settings.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.settings.apiKey
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Flow Hub Error (${response.status}): ${errorText || 'Unreachable'}`);
    }

    return response.json();
  }

  async listFlows(): Promise<FlowHubFlow[]> {
    const data = await this.request('call_tool', {
      name: 'list_flowise_chatflows',
      arguments: {}
    });
    
    // Parsing logic based on expected MCP tool output format
    try {
      const textContent = data.result.content[0].text;
      return JSON.parse(textContent);
    } catch (e) {
      console.error("Failed to parse flows from MCP", e);
      return [];
    }
  }

  async runFlow(chatflowId: string, input: string, sessionId?: string) {
    const data = await this.request('call_tool', {
      name: 'run_flowise_chatflow',
      arguments: {
        chatflowId,
        input,
        sessionId
      }
    });
    return data.result.content[0].text;
  }

  async testConnection() {
    // Attempt to list tools to verify API Key and URL
    return await this.request('list_tools');
  }
}
