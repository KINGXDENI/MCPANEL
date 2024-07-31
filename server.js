const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const util = require('minecraft-server-util');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const RCON_HOST = 'localhost';
const RCON_PORT = 25575;
const RCON_PASSWORD = 'your-rcon-password';

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('New client connected');

    // Send server log to client using tail -f
    const logStream = exec('tail -f /home/dibo-mc/htdocs/mc.dibo.my.id/logs/latest.log');

    logStream.stdout.on('data', (data) => {
        socket.emit('server-log', data);
    });

    logStream.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    logStream.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });

    // Handle RCON command from client
    socket.on('rcon-command', async (command) => {
        try {
            const response = await util.rcon(RCON_HOST, RCON_PORT, RCON_PASSWORD, command);
            socket.emit('rcon-response', response);
        } catch (error) {
            socket.emit('rcon-response', `Error: ${error.message}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 8900;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
