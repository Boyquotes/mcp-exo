import express from "express";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";;
import { z } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import cors from "cors"


// SSE Transport Instance
let transport = null;

// Create an MCP server
const server = new McpServer({
  name: "beChill",
  version: "1.0.0"
});

// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

server.tool(
  "echo",
  { message: z.string() },
  async ({ message }) => ({
    content: [{ type: "text", text: `Tool echo: ${message}` }]
  })
);

server.tool(
  "calculate-bmi",
  {
    weightKg: z.number(),
    heightM: z.number()
  },
  async ({ weightKg, heightM }) => ({
    content: [{
      type: "text",
      text: String(weightKg / (heightM * heightM))
    }]
  })
);

server.tool(
  "fetch-carts",
  { id  : z.string() },
  async ({ id }) => {
    const response = await fetch(`https://dummyjson.com/carts/${id}`);
    const data = await response.text();
    // console.log("Raw response:", data);
    return {
      content: [{ type: "text", text: data }]
    };
  }
);

// Static resource
server.resource(
  "config",
  "config://app",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "App configuration here"
    }]
  })
);

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

server.resource(
  "user-profile",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  async (uri, { userId }) => ({
    contents: [{
      uri: uri.href,
      text: `Profile data for user ${userId}`
    }]
  })
);

server.prompt(
  "review-code",
  { code: z.string() },
  ({ code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review this code:\n\n${code}`
      }
    }]
  })
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