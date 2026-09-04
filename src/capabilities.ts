import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const CANONICAL_MUTATION_CAPABILITIES = [
  "calendar_create_calendar",
  "calendar_create_event",
  "calendar_delete_event",
  "calendar_update_event",
  "docs_batch_update",
  "docs_create_document",
  "drive_copy_file",
  "drive_create_comment",
  "drive_create_folder",
  "drive_delete_comment",
  "drive_reply_to_comment",
  "drive_resolve_comment",
  "gmail_create_draft",
  "gmail_send_draft",
  "gmail_send_email",
  "sheets_append_values",
  "sheets_batch_update",
  "sheets_clear_values",
  "sheets_create_pivot_table",
  "sheets_create_spreadsheet",
  "sheets_duplicate_sheet",
  "sheets_update_values"
] as const;

export const CANONICAL_READ_ONLY_CAPABILITIES = [
  "calendar_freebusy_query",
  "calendar_get_event",
  "calendar_list_calendars",
  "calendar_list_events",
  "docs_get_document",
  "drive_get_file",
  "drive_list_comments",
  "drive_list_files",
  "drive_search_files",
  "gmail_get_attachment",
  "gmail_get_message",
  "gmail_get_thread",
  "gmail_list_attachments",
  "gmail_list_labels",
  "gmail_list_messages",
  "gmail_list_threads",
  "sheets_batch_get_values",
  "sheets_get_spreadsheet",
  "sheets_get_values"
] as const;

const canonicalCapabilities = new Set<string>([
  ...CANONICAL_READ_ONLY_CAPABILITIES,
  ...CANONICAL_MUTATION_CAPABILITIES
]);

/**
 * Advertise only the explicit canonical tool inventory. Tool-provided
 * annotations are metadata and are not trusted to authorize a capability.
 */
export function withCanonicalMutationSurface(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, property, receiver) {
      if (property !== "registerTool") {
        return Reflect.get(target, property, receiver);
      }

      return (name: string, ...args: unknown[]) => {
        if (!canonicalCapabilities.has(name)) {
          return undefined;
        }

        const registerTool = Reflect.get(target, property, target);
        return Reflect.apply(registerTool, target, [name, ...args]);
      };
    }
  });
}
