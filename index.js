const express = require('express');
const app = express();
const cors = require('cors');
const httpServer = require('http').createServer(app);
const socketIO = require('socket.io');
const fs = require('fs');

app.use(cors());

const io = socketIO(httpServer, {
    cors: {
        origin: "http://localhost:8080"
    }
});

const { Client } = require('whatsapp-web.js');
const SESSION_FILE_PATH = './session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({ restartOnAuthFail:true, puppeteer: { headless: true }, session: sessionCfg });
client.initialize()

io.on('connection', (socket) => {
    client.on('qr', (qr) => {
        console.log("get qr");
        socket.emit('qr', qr);
    });

    client.on('authenticated', (session) => {
        console.log("authenticated");
        sessionCfg=session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
            if (err) {
                console.error(err);
            }
        });
    });

    client.on('disconnected', (state) => {
        console.log('disconnect');
        socket.emit('disconnect', state);
    });

    socket.on('sendMessage', (data) => {
        client.sendMessage(data.to, data.message)
    });

    client.on('ready', () => {
        console.log("ready");
        socket.emit('authenticated', true);
    });

    client.on('change_state', (state) => {
        console.log("change");
        socket.emit('state', state)
    })

    client.on('auth_failure', () => {
        sessionCfg = ""
        fs.unlinkSync(SESSION_FILE_PATH);
        socket.emit('disconnect', state);
        console.log("auth fail");
    })
});

app.get('/checkAuth', (req, res) => {
    fs.access(SESSION_FILE_PATH, (err) => {
        if(!err){
            res.send({session:true});
        }else{
            res.send({session:false});
        }
    });
});
app.delete('/clearSession', (req, res) => {
    sessionCfg = ""
    fs.unlinkSync(SESSION_FILE_PATH);
    client.initialize();
    res.send(true);
});
httpServer.listen(5000);