import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

// SSE Transport Instance
let transport = null;

// MCP Server Instance
const server = new McpServer({
  name: "mcp-ai-server",
  version: "1.0.0"
});

// Echo Tool
server.tool(
  "echo",
  { message: z.string().describe("The message to echo") },
  async ({ message }) => ({
    content: [{ type: "text", text: `Tool echo: ${message}` }]
  })
);

// Add tool
server.tool(
  "add",
  { a: z.number().describe("The first number to add"), b: z.number().describe("The second number to add") },
  async ({ a, b }) => {
    const result = a + b;
    return {
      result,
      content: [{ type: "text", text: `${a} + ${b} = ${result}` }]
    };
  }
);

// Express App Instance
const app = express();

// CORS Configuration
app.use(cors({
  origin: "http://localhost:3000",
  methods: ['GET', 'POST'],
  credentials: true,
}));

// SSE Connection Route Handler
const handleSseConnection = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  transport = new SSEServerTransport('/messages', res);
  try {
    await server.connect(transport);
    console.log('✅ MCP client connected via SSE');
  } catch (error) {
    console.error('❌ Error connecting to MCP client:', error);
    res.status(500).end();
  }
};

// Message Route Handler
const handleMessages = async (req, res) => {
  if (!transport) {
    return res.status(503).json({
      error: { code: -32003, message: 'SSE transport not started' }
    });
  }
  
  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('❌ Error processing message:', error);
    res.status(500).json({
      error: {
        code: -32000,
        message: 'Internal server error'
      }
    });
  }
};

// Route Registration
app.get("/sse", handleSseConnection);
app.post("/messages", handleMessages);

// Server Start
const port = 3002;
app.listen(port, () => {
  console.log(`✅ MCP server running on port ${port}`);
});