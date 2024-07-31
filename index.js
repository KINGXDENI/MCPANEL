const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const {
    RCON
} = require('minecraft-server-util');
const {
    exec
} = require('child_process');
const {
    execSync
} = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const RCON_HOST = 'localhost';
const RCON_PORT = 25575;
const RCON_PASSWORD = '123dendut';

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Check server status
function getServerStatus(callback) {
    exec('sudo systemctl is-active minecraft', (error, stdout) => {
        if (error) {
            callback('unknown');
            return;
        }
        callback(stdout.trim() === 'active' ? 'running' : 'stopped');
    });
}

// Socket.io handling
io.on('connection', (socket) => {
    console.log('New client connected');

    // Send server log to client using tail -f
    const logStream = exec('sudo tail -f /home/dibo-mc/htdocs/mc.dibo.my.id/logs/latest.log');

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
        const client = new RCON();
        const connectOpts = {
            timeout: 1000 * 5
        };
        const loginOpts = {
            timeout: 1000 * 5
        };

        try {
            await client.connect(RCON_HOST, RCON_PORT, connectOpts);
            await client.login(RCON_PASSWORD, loginOpts);

            const response = await client.execute(command);
            socket.emit('rcon-response', response);
        } catch (error) {
            socket.emit('rcon-response', `Error: ${error.message}`);
        } finally {
            await client.close();
        }
    });

    // Handle server management commands
    socket.on('server-control', (action) => {
        let command;
        switch (action) {
            case 'start':
                command = 'sudo systemctl start minecraft';
                break;
            case 'stop':
                command = 'sudo systemctl stop minecraft';
                break;
            case 'restart':
                command = 'sudo systemctl restart minecraft';
                break;
            default:
                socket.emit('server-control-response', 'Invalid action');
                return;
        }
        exec(command, (error, stdout, stderr) => {
            if (error) {
                socket.emit('server-control-response', `Error: ${stderr}`);
                return;
            }
            socket.emit('server-control-response', `Server action completed: ${stdout}`);
            // Update status after action
            getServerStatus(status => {
                socket.emit('server-status', status);
            });
        });
    });

    // Check server status on connection
    socket.on('check-server-status', () => {
        getServerStatus(status => {
            socket.emit('server-status', status);
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 8900;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
