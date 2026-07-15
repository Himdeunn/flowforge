import { Injectable } from '@nestjs/common';
import * as vm from 'vm';

@Injectable()
export class StepExecutor {
  /**
   * Helper to interpolate string templates like {{steps.nodeId.output.property}}
   */
  public interpolate(value: any, context: { steps: Record<string, any> }): any {
    if (typeof value === 'string') {
      // Regular expression to find {{steps.nodeId.path}}
      const regex = /\{\{steps\.([^}]+)\}\}/g;

      // If the string is EXACTLY a single template expression, we return the actual type (not just stringified)
      const exactMatch = value.match(/^\{\{steps\.([^}]+)\}\}$/);
      if (exactMatch) {
        return this.resolvePath(exactMatch[1], context.steps);
      }

      return value.replace(regex, (match, path) => {
        const resolved = this.resolvePath(path, context.steps);
        if (resolved === undefined || resolved === null) {
          return '';
        }
        return typeof resolved === 'object'
          ? JSON.stringify(resolved)
          : String(resolved);
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.interpolate(item, context));
    }

    if (typeof value === 'object' && value !== null) {
      const result: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        result[key] = this.interpolate(value[key], context);
      }
      return result;
    }

    return value;
  }

  private resolvePath(pathStr: string, obj: any): any {
    const parts = pathStr.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  async execute(
    stepNode: { id: string; type: string; config: any },
    context: { steps: Record<string, any> },
  ): Promise<any> {
    const interpolatedConfig = this.interpolate(stepNode.config || {}, context);

    switch (stepNode.type) {
      case 'http': {
        const { method = 'GET', url, headers = {}, body } = interpolatedConfig;
        if (!url) {
          throw new Error(`HTTP step "${stepNode.id}" is missing target URL.`);
        }

        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        };

        if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          fetchOptions.body =
            typeof body === 'object' ? JSON.stringify(body) : String(body);
        }

        const res = await fetch(url, fetchOptions);
        const contentType = res.headers.get('content-type') || '';

        let responseBody: any;
        if (contentType.includes('application/json')) {
          responseBody = await res.json();
        } else {
          responseBody = await res.text();
        }

        if (!res.ok) {
          throw new Error(
            `HTTP request failed with status ${res.status}: ${
              typeof responseBody === 'object'
                ? JSON.stringify(responseBody)
                : responseBody
            }`,
          );
        }

        return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: responseBody,
        };
      }

      case 'delay': {
        const { durationMs } = interpolatedConfig;
        if (typeof durationMs !== 'number' || durationMs < 0) {
          throw new Error(
            `Delay step "${stepNode.id}" has invalid durationMs: ${durationMs}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, durationMs));
        return { durationMs, completed: true };
      }

      case 'condition': {
        const { expression } = interpolatedConfig;
        if (!expression) {
          throw new Error(
            `Condition step "${stepNode.id}" is missing expression.`,
          );
        }

        // Evaluate expression using node vm
        try {
          const result = vm.runInNewContext(expression, {}, { timeout: 1000 });
          return { expression, result: !!result };
        } catch (err) {
          throw new Error(
            `Condition step "${stepNode.id}" evaluation error: ${err.message}`,
          );
        }
      }

      case 'script': {
        const { script } = interpolatedConfig;
        if (!script) {
          throw new Error(
            `Script step "${stepNode.id}" is missing script source code.`,
          );
        }

        const sandbox = {
          steps: context.steps,
          output: {} as Record<string, any>,
        };

        try {
          vm.createContext(sandbox);
          // Wrap in IIFE to capture the return value or execute code block
          const wrappedScript = `
            (function() {
              ${script}
            })()
          `;
          const result = vm.runInContext(wrappedScript, sandbox, {
            timeout: 5000,
          });

          // Return the result of the script or fallback to sandbox.output
          if (result !== undefined) {
            return result;
          }
          return sandbox.output;
        } catch (err) {
          throw new Error(
            `Script step "${stepNode.id}" failed: ${err.message}`,
          );
        }
      }

      default:
        throw new Error(`Unsupported step type: "${stepNode.type}"`);
    }
  }
}
