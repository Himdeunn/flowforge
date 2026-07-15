import { Injectable, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseAndValidateDag } from '../execution/dag-parser';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    }
  }

  async generateWorkflow(prompt: string, currentDefinition?: any): Promise<any> {
    // Truncate prompt to ~500 tokens (approx. 2000 characters)
    if (prompt.length > 2000) {
      prompt = prompt.substring(0, 2000) + '...';
    }

    const isTestMode = this.configService.get<string>('NODE_ENV') === 'test';
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    // 1. Mock fallback for E2E tests without real key
    if (isTestMode || !apiKey) {
      return this.getMockDag(prompt, currentDefinition);
    }

    const systemInstruction = `
You are a helpful AI assistant that translates natural language descriptions into valid FlowForge workflow definitions in JSON format.
A FlowForge workflow definition represents a Directed Acyclic Graph (DAG) consisting of 'nodes' and 'edges'.

Skema JSON Target:
{
  "nodes": [
    {
      "id": "unique-node-id", // string, unique per node, e.g. "fetch_data"
      "type": "http" | "script" | "delay" | "condition",
      "config": {
        // for "http":
        "url": "http://example.com/api",
        "method": "GET" | "POST" | "PUT" | "DELETE",
        "headers": {}, // optional object
        "body": "stringified or raw body", // optional
        "maxRetries": number, // optional, default 3
        "baseDelayMs": number, // optional, default 1000
        
        // for "script":
        "script": "JavaScript code, e.g., output.status = 200;",
        
        // for "delay":
        "durationMs": number, // e.g. 5000
        
        // for "condition":
        "expression": "JavaScript condition evaluation, e.g., steps.fetch_data.output.status === 200"
      }
    }
  ],
  "edges": [
    {
      "from": "source-node-id",
      "to": "target-node-id",
      "conditionValue": true | false // optional, only if source node is of type "condition"
    }
  ]
}

Few-shot Contoh 1 (New workflow from scratch):
Description: "Delay 5 detik lalu ambil data dari http://api.com/users"
Output:
{
  "nodes": [
    { "id": "wait_step", "type": "delay", "config": { "durationMs": 5000 } },
    { "id": "fetch_users", "type": "http", "config": { "url": "http://api.com/users", "method": "GET" } }
  ],
  "edges": [
    { "from": "wait_step", "to": "fetch_users" }
  ]
}

Few-shot Contoh 2 (Edit existing workflow):
Current Definition:
{
  "nodes": [
    { "id": "fetch_data", "type": "http", "config": { "url": "http://api.com/data", "method": "GET" } }
  ],
  "edges": []
}
Prompt: "tambahkan delay 2 detik setelah fetch_data"
Output:
{
  "nodes": [
    { "id": "fetch_data", "type": "http", "config": { "url": "http://api.com/data", "method": "GET" } },
    { "id": "delay_step", "type": "delay", "config": { "durationMs": 2000 } }
  ],
  "edges": [
    { "from": "fetch_data", "to": "delay_step" }
  ]
}

Constraints:
1. Return ONLY the raw JSON string matching the structure above. Do not wrap it in markdown code blocks or add any other text.
2. The generated graph MUST be a valid Directed Acyclic Graph (DAG) with no cycles.
3. Ensure all edge connections link existing nodes.
`;

    const fullPrompt = `${systemInstruction}\n\n` + 
      (currentDefinition ? `Current Workflow Definition: ${JSON.stringify(currentDefinition)}\n\n` : '') + 
      `User Prompt: "${prompt}"\n\nOutput JSON:`;

    try {
      let resultText: string;
      let parsedJson: any;
      let attempt = 1;
      const maxAttempts = 2;

      while (attempt <= maxAttempts) {
        try {
          if (attempt === 1) {
            resultText = await this.callGemini(fullPrompt);
          } else {
            // Corrective prompt for attempt 2
            const correctivePrompt = `${fullPrompt}\n\nYour previous response was invalid. Please ensure you output ONLY a valid JSON matching the schema and it is a Directed Acyclic Graph (DAG) with no cycles. Correct it and output ONLY the valid JSON:`;
            resultText = await this.callGemini(correctivePrompt);
          }

          parsedJson = JSON.parse(resultText);
          
          // Validate schema and check for cycles
          parseAndValidateDag(parsedJson);
          
          // If we reach here, it's successful
          return parsedJson;
        } catch (err) {
          if (attempt === maxAttempts) {
            throw err; // Escalate error to outer catch
          }
          attempt++;
        }
      }
    } catch (err) {
      throw new UnprocessableEntityException(
        `AI was unable to generate a valid workflow from this description. Try being more specific. Error: ${err.message}`,
      );
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  }

  private getMockDag(prompt: string, currentDefinition?: any): any {
    // If editing existing workflow
    if (currentDefinition && currentDefinition.nodes) {
      const cloned = JSON.parse(JSON.stringify(currentDefinition));
      if (prompt.toLowerCase().includes('http')) {
        const newNodeId = `step_http_${cloned.nodes.length + 1}`;
        cloned.nodes.push({
          id: newNodeId,
          type: 'http',
          config: { url: 'http://api.com/new', method: 'GET' },
        });
        if (cloned.nodes.length > 1) {
          cloned.edges.push({
            from: cloned.nodes[cloned.nodes.length - 2].id,
            to: newNodeId,
          });
        }
      } else {
        const newNodeId = `step_delay_${cloned.nodes.length + 1}`;
        cloned.nodes.push({
          id: newNodeId,
          type: 'delay',
          config: { durationMs: 1000 },
        });
        if (cloned.nodes.length > 1) {
          cloned.edges.push({
            from: cloned.nodes[cloned.nodes.length - 2].id,
            to: newNodeId,
          });
        }
      }
      return cloned;
    }

    // Default mock for new workflow
    return {
      nodes: [
        { id: 'node1', type: 'delay', config: { durationMs: 1000 } },
        { id: 'node2', type: 'http', config: { url: 'http://example.com/api', method: 'GET' } },
      ],
      edges: [
        { from: 'node1', to: 'node2' },
      ],
    };
  }
}
