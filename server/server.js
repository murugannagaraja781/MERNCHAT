const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

// Detect environment - Railway sets PORT env variable
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.PORT;
const PORT = process.env.PORT || 8443;

function main() {
  const server = IS_PRODUCTION ? startHttpServer() : startHttpsServer();
  startWebSocketServer(server);
  printHelp();
}

function startHttpServer() {
  console.log('Starting HTTP server (production mode)...');
  const handleRequest = createRequestHandler();
  const httpServer = http.createServer(handleRequest);
  httpServer.listen(PORT, '0.0.0.0');
  return httpServer;
}

function startHttpsServer() {
  console.log('Starting HTTPS server (development mode)...');

  // Check if certificates exist
  const keyPath = path.join(__dirname, '..', 'key.pem');
  const certPath = path.join(__dirname, '..', 'cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error('ERROR: TLS certificates not found!');
    console.error('Please run: ./generate_cert.sh');
    process.exit(1);
  }

  const serverConfig = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const handleRequest = createRequestHandler();
  const httpsServer = https.createServer(serverConfig, handleRequest);
  httpsServer.listen(PORT, '0.0.0.0');
  return httpsServer;
}

function createRequestHandler() {
  const clientDir = path.join(__dirname, '..', 'client');

  return (request, response) => {
    console.log(`request received: ${request.url}`);

    // This server only serves two files: The HTML page and the client JS file
    if(request.url === '/') {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(fs.readFileSync(path.join(clientDir, 'index.html')));
    } else if(request.url === '/webrtc.js') {
      response.writeHead(200, {'Content-Type': 'application/javascript'});
      response.end(fs.readFileSync(path.join(clientDir, 'webrtc.js')));
    } else {
      response.writeHead(404);
      response.end('Not Found');
    }
  };
}

function startWebSocketServer(server) {
  // Create a server for handling websocket calls
  const wss = new WebSocketServer({server: server});

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('message', (message) => {
      // Broadcast any received message to all clients
      console.log(`received: ${message}`);
      wss.broadcast(message);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  wss.broadcast = function(data) {
    this.clients.forEach((client) => {
      if(client.readyState === WebSocket.OPEN) {
        client.send(data, {binary: false});
      }
    });
  };
}

function printHelp() {
  const protocol = IS_PRODUCTION ? 'http' : 'https';
  const host = IS_PRODUCTION ? `0.0.0.0:${PORT}` : `localhost:${PORT}`;

  console.log(`\n✓ Server running in ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
  console.log(`✓ Visit ${protocol}://${host} in your browser\n`);

  if (!IS_PRODUCTION) {
    console.log('Development mode notes:');
    console.log('  * Note the HTTPS in the URL; there is no HTTP -> HTTPS redirect.');
    console.log('  * You\'ll need to accept the invalid TLS certificate as it is self-signed.');
    console.log('  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once.');
    console.log('    You may need to use two different browsers or machines.\n');
  }
}

main();
