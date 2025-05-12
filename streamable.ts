import express, { Request, Response } from "express";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'MCP-Session-ID'],
  exposedHeaders: ['MCP-Session-ID']
}));

const getServer = () => {
  const server = new McpServer({
    name: "beChill-stateless",
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
    { id: z.string() },
    async ({ id }) => {
      const response = await fetch(`https://dummyjson.com/carts/${id}`);
      const data = await response.text();
      return {
        content: [{ type: "text", text: data }]
      };
    }
  );

  return server;
};

app.post('/mcp', async (req: Request, res: Response) => {
  // In stateless mode, create a new instance of transport and server for each request
  // to ensure complete isolation. A single instance would cause request ID collisions
  // when multiple clients connect concurrently.
  
  try {
    const server = getServer(); 
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      console.log('Request closed');
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

app.get('/mcp', async (req: Request, res: Response) => {
  console.log('Received GET MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

app.delete('/mcp', async (req: Request, res: Response) => {
  console.log('Received DELETE MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});


// Start the server
const PORT = 3050;
app.listen(PORT, () => {
  console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
  console.log(`MCP endpoint available at http://localhost:${PORT}/mcp`);
});

