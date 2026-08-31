import assert from "node:assert/strict";
import test from "node:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CANONICAL_MUTATION_CAPABILITIES,
  CANONICAL_READ_ONLY_CAPABILITIES,
  withCanonicalMutationSurface
} from "../src/capabilities.js";
import { CreateCalendarSchema } from "../src/schemas/calendar.js";
import { CreateFolderSchema } from "../src/schemas/drive.js";
import { registerCalendarTools } from "../src/tools/calendar.js";
import { registerDocsTools } from "../src/tools/docs.js";
import { registerDriveTools } from "../src/tools/drive.js";
import { registerGmailTools } from "../src/tools/gmail.js";
import { registerSheetsTools } from "../src/tools/sheets.js";

type ToolHandler = (params: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
}>;

interface ToolConfig {
  annotations?: {
    readOnlyHint?: boolean;
  };
}

interface RegisteredTool {
  name: string;
  config: ToolConfig;
  handler: ToolHandler;
}

const EXPECTED_READ_ONLY_TOOL_NAMES = [
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
].sort();

const EXPECTED_MUTATION_TOOL_NAMES = [
  "calendar_create_calendar",
  "drive_create_folder"
].sort();

const EXPECTED_TOOL_NAMES = [
  ...EXPECTED_READ_ONLY_TOOL_NAMES,
  ...EXPECTED_MUTATION_TOOL_NAMES
].sort();

class RecordingServer {
  readonly tools: RegisteredTool[] = [];

  registerTool(name: string, config: ToolConfig, handler: ToolHandler): void {
    this.tools.push({ name, config, handler });
  }

  asMcpServer(): McpServer {
    return this as unknown as McpServer;
  }

  handler(name: string): ToolHandler {
    const tool = this.tools.find(candidate => candidate.name === name);
    assert.ok(tool, `Expected ${name} to be registered`);
    return tool.handler;
  }
}

test("name schemas reject missing/blank names and preserve exact valid names", () => {
  for (const schema of [CreateCalendarSchema, CreateFolderSchema]) {
    assert.equal(schema.safeParse({}).success, false);
    for (const name of ["", "   ", "\n\t"]) {
      assert.equal(schema.safeParse({ name }).success, false);
    }

    const exactName = "  Exact Ω Name  ";
    assert.equal(schema.parse({ name: exactName }).name, exactName);
  }
});

test("calendar_create_calendar sends only the exact summary and returns provider read-back fields", async () => {
  const calls: unknown[] = [];
  const calendarClient = {
    calendars: {
      async insert(request: unknown) {
        calls.push(request);
        return {
          data: {
            id: "calendar-provider-id",
            summary: "  Exact Calendar Ω  ",
            description: "Provider description",
            location: "Provider location",
            timeZone: "America/Chicago",
            etag: "calendar-etag"
          }
        };
      }
    }
  };
  const server = new RecordingServer();
  registerCalendarTools(server.asMcpServer(), () => calendarClient as never);

  const result = await server.handler("calendar_create_calendar")({
    name: "  Exact Calendar Ω  "
  });

  assert.deepEqual(calls, [{
    requestBody: { summary: "  Exact Calendar Ω  " },
    fields: "id,summary,description,location,timeZone,etag"
  }]);
  assert.deepEqual(result.structuredContent, {
    id: "calendar-provider-id",
    name: "  Exact Calendar Ω  ",
    summary: "  Exact Calendar Ω  ",
    description: "Provider description",
    location: "Provider location",
    timeZone: "America/Chicago",
    etag: "calendar-etag"
  });
});

test("drive_create_folder creates only a private folder and returns provider read-back fields", async () => {
  const calls: unknown[] = [];
  const driveClient = {
    files: {
      async create(request: unknown) {
        calls.push(request);
        return {
          data: {
            id: "folder-provider-id",
            name: "  Exact Folder Ω  ",
            mimeType: "application/vnd.google-apps.folder",
            createdTime: "2026-08-30T12:00:00.000Z",
            modifiedTime: "2026-08-30T12:00:00.000Z",
            parents: ["root"],
            trashed: false
          }
        };
      }
    }
  };
  const server = new RecordingServer();
  registerDriveTools(server.asMcpServer(), () => driveClient as never);

  const result = await server.handler("drive_create_folder")({
    name: "  Exact Folder Ω  "
  });

  assert.deepEqual(calls, [{
    requestBody: {
      name: "  Exact Folder Ω  ",
      mimeType: "application/vnd.google-apps.folder"
    },
    fields: "id,name,mimeType,createdTime,modifiedTime,parents,trashed",
    ignoreDefaultVisibility: true
  }]);
  assert.deepEqual(result.structuredContent, {
    id: "folder-provider-id",
    name: "  Exact Folder Ω  ",
    mimeType: "application/vnd.google-apps.folder",
    createdTime: "2026-08-30T12:00:00.000Z",
    modifiedTime: "2026-08-30T12:00:00.000Z",
    parents: ["root"],
    trashed: false
  });
});

test("all five modules advertise the exact expected tool inventory", () => {
  const server = new RecordingServer();
  const mcpServer = server.asMcpServer();

  registerDocsTools(mcpServer);
  registerDriveTools(mcpServer);
  registerSheetsTools(mcpServer);
  registerGmailTools(mcpServer);
  registerCalendarTools(mcpServer);

  assert.deepEqual(
    server.tools.map(tool => tool.name).sort(),
    EXPECTED_TOOL_NAMES
  );
});

test("the canonical guard preserves every read-only name and rejects annotation-only authorization", () => {
  assert.deepEqual(
    [...CANONICAL_READ_ONLY_CAPABILITIES].sort(),
    EXPECTED_READ_ONLY_TOOL_NAMES
  );

  const server = new RecordingServer();
  const guardedServer = withCanonicalMutationSurface(server.asMcpServer());
  const handler: ToolHandler = async () => ({ content: [] });

  for (const name of EXPECTED_READ_ONLY_TOOL_NAMES) {
    guardedServer.registerTool(
      name,
      { annotations: { readOnlyHint: false } },
      handler
    );
  }
  guardedServer.registerTool(
    "forbidden_annotation_claim",
    { annotations: { readOnlyHint: true } },
    handler
  );

  assert.deepEqual(server.tools.map(tool => tool.name), EXPECTED_READ_ONLY_TOOL_NAMES);
});

test("the advertised mutation names are exactly the two canonical capabilities", () => {
  const server = new RecordingServer();
  const mcpServer = server.asMcpServer();

  registerDocsTools(mcpServer);
  registerDriveTools(mcpServer);
  registerSheetsTools(mcpServer);
  registerGmailTools(mcpServer);
  registerCalendarTools(mcpServer);

  const advertisedNames = server.tools.map(tool => tool.name);
  const advertisedReadOnlyNames = advertisedNames
    .filter(name => EXPECTED_READ_ONLY_TOOL_NAMES.includes(name))
    .sort();
  const mutationNames = advertisedNames
    .filter(name => !EXPECTED_READ_ONLY_TOOL_NAMES.includes(name))
    .sort();

  assert.deepEqual(advertisedReadOnlyNames, EXPECTED_READ_ONLY_TOOL_NAMES);
  assert.deepEqual(mutationNames, EXPECTED_MUTATION_TOOL_NAMES);
  assert.deepEqual([...CANONICAL_MUTATION_CAPABILITIES].sort(), EXPECTED_MUTATION_TOOL_NAMES);

  const forbiddenMutation = /(shar|permission|public.?link|event|file|document|gmail)/i;
  assert.deepEqual(mutationNames.filter(name => forbiddenMutation.test(name)), []);
});
