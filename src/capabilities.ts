import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const CANONICAL_MUTATION_CAPABILITIES = [
  "calendar_create_calendar",
  "drive_create_folder"
] as const;

const canonicalMutationCapabilities = new Set<string>(CANONICAL_MUTATION_CAPABILITIES);

interface ToolRegistrationConfig {
  annotations?: {
    readOnlyHint?: boolean;
  };
}

/**
 * Preserve every explicitly read-only tool while limiting writes to the
 * canonical capabilities approved for this source.
 */
export function withCanonicalMutationSurface(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, property, receiver) {
      if (property !== "registerTool") {
        return Reflect.get(target, property, receiver);
      }

      return (name: string, config: ToolRegistrationConfig, ...args: unknown[]) => {
        const isReadOnly = config.annotations?.readOnlyHint === true;
        if (!isReadOnly && !canonicalMutationCapabilities.has(name)) {
          return undefined;
        }

        const registerTool = Reflect.get(target, property, target);
        return Reflect.apply(registerTool, target, [name, config, ...args]);
      };
    }
  });
}
