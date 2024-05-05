/*const http = require('http');
const { exec } = require('child_process');*/
import http from 'http';
import { exec } from 'child_process';
import net from 'net';
import os from 'os';
// Start Python server and handle its stdout and stderr
const platform = os.platform();
const scriptName = platform === "darwin" ? "transcribe-server-mac.py" : "transcribe-server-all.py";
const pythonServer = exec(`python ${scriptName}`);

pythonServer.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
});

pythonServer.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
});

function checkServer() {
    // Attempt to connect to the TCP server
    const client = net.createConnection({ host: '127.0.0.1', port: 51318 }, () => {
        console.log('Python server is up and running');
        client.end();

        // Start the main Node script and handle its stdout and stderr
        const nodeApp = exec('node index.js');
        nodeApp.stdout.on('data', (data) => {
            console.log(`Node stdout: ${data}`);
        });
        nodeApp.stderr.on('data', (data) => {
            console.error(`Node stderr: ${data}`);
        });
    });

    client.on('error', (err) => {
        console.log('Waiting for Python server...');
        setTimeout(checkServer, 1000); // check every second
    });
}

// Initial check
checkServer();