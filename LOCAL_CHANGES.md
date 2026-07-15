# Local Google Workspace MCP extensions

This checkout is pinned to upstream commit `60413ef4ec54793b8befe7386230c7e296964478` (`google-workspace-mcp-server` 1.4.3).

Local additions:

- `gmail_send_email`: sends a new Gmail message immediately.
- `gmail_send_draft`: sends a previously created Gmail draft by draft ID.
- Recipient email validation and subject newline rejection to prevent header injection.
- Tool descriptions require explicit user authorization before sending.

The canonical launcher is `/Users/kevin/.hermes/scripts/google-workspace-mcp.sh`.

Verification:

```bash
npm ci
npm run build
hermes mcp test google-workspace
```

Expected discovery includes both `gmail_send_email` and `gmail_send_draft`.
