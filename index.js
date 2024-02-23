import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server);
const PORT = 4000;

// allow cors origin requests
app.use(cors());

app.get('/', (req, res) => {
    res.send(`<html>
        WebSocket server active.
    </html>`
    )
})

io.on('connection', async (socket) => {
    socket.on('disconnect', () => {
        console.log('A User Got Disconnected.');
    });

    socket.on('video_data', async (videoChunk) => {
        
        io.emit('broadcast_video', videoChunk);
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on port: ${PORT} `)
})
