const http = require('http');

const fs = require('fs');
var WebSocketServer = require('ws').Server;

const express = require('express');
const serveIndex = require('serve-index')

const app = express();
const bodyParser = require('body-parser');

//large limit lets us send pictures
app.use(bodyParser.text({ type: "*/*", limit: '50mb', extended: true }))

phoneSensors = {};
const sensors = {};
let counter = 0;
let checksumErr = 0;
let packetErr = 0;
let lastActuator = 0;
let lastUser = '';

function log(msg) {
    //console.info(msg);
}
const SerialPort = require('serialport')
options = { baudRate: 115200, dataBits: 8, parity: 'none', stopBits: 1, flowControl: 0 };

const port = new SerialPort('/dev/ttyUSB0', options)
const InterByteTimeout = require('@serialport/parser-inter-byte-timeout')

//log(port)
port.on('error', function(err) {
    console.error('Error: ', err.message)
})

port.once('open', () => {
    log('open')
    const length = 84;
    const parser = port.pipe(new InterByteTimeout({ interval: 100, maxBufferSize: length }))
    parser.on('data', (data) => {
        if (data.length != 84 || data[0] != 19) {
            packetErr++
            console.error(data.length, data.toString())
            setTimeout(stopStreaming, 0);
            setTimeout(() => port.flush(), 50) //flush?
            setTimeout(streamSensors, 300);
            return;
        }
        var checksum = 0;
        for (var i = data.length - 1; i >= 0; i--) {
            checksum += data[i];
        }
        if (checksum & 0xFF) {
            console.error('Checksum fail', 'checksum');
            checksumErr++;
            return
        }
        data = data.slice(3, -1);
        //console.log(data.length, data.toString('hex'))
        const buffer = new Uint8Array(data).buffer;
        const dataView = new DataView(buffer);
        sensors['bumps'] = dataView.getUint8(0);
        sensors['wall'] = dataView.getUint8(1);
        sensors['cliffLeft'] = dataView.getUint8(2);
        sensors['cliffFrontLeft'] = dataView.getUint8(3);
        sensors['cliffFrontRight'] = dataView.getUint8(4);
        sensors['cliffRight'] = dataView.getUint8(5);
        sensors['virtualWall'] = dataView.getUint8(6);
        //sensors['overCurrents'] = dataView.getUint8(7);
        // sensors['dirtDetect'] = dataView.getUint8(8);
        //sensors['unused1'] = dataView.getUint8(9);
        sensors['irOpcode'] = dataView.getUint8(10);
        sensors['buttons'] = dataView.getUint8(11);
        //sensors['distance'] = dataView.getInt16(12);
        //sensors['angle'] = dataView.getInt16(14);
        sensors['chargingState'] = dataView.getUint8(15);
        sensors['voltage'] = dataView.getUint16(17);
        sensors['current'] = dataView.getInt16(19);
        sensors['temperature'] = dataView.getInt8(21);
        sensors['batteryCharge'] = dataView.getUint16(22);
        sensors['batteryCapacity'] = dataView.getUint16(24);
        sensors['wallSignal'] = dataView.getUint16(26);
        sensors['cliffLeftSignal'] = dataView.getUint16(28);
        sensors['cliffFrontLeftSignal'] = dataView.getUint16(30);
        sensors['cliffFrontRightSignal'] = dataView.getUint16(32);
        sensors['cliffRightSignal'] = dataView.getUint16(34);
        //sensors['unused2'] = dataView.getUint8(35);
        //sensors['unused3'] = dataView.getUint16(37);
        sensors['chargerAvailable'] = dataView.getUint8(39);
        sensors['openInterfaceMode'] = dataView.getUint8(40);
        sensors['songNumber'] = dataView.getUint8(41);
        sensors['songPlaying'] = dataView.getUint8(42);
        //sensors['oiStreamNumPackets'] = dataView.getUint8(43);
        //sensors['velocity'] = dataView.getInt16(44);
        //sensors['radius'] = dataView.getInt16(46);
        sensors['velocityRight'] = dataView.getInt16(48);
        sensors['velocityLeft'] = dataView.getInt16(50);
        sensors['encoderCountLeft'] = dataView.getInt16(52);
        sensors['encoderCountRight'] = dataView.getInt16(54);
        sensors['lightBumper'] = dataView.getUint8(56);
        sensors['lightBumperLeft'] = dataView.getUint16(57);
        sensors['lightBumperFrontLeft'] = dataView.getUint16(59);
        sensors['lightBumperCenterLeft'] = dataView.getUint16(61);
        sensors['lightBumperCenterRight'] = dataView.getUint16(63);
        sensors['lightBumperFrontRight'] = dataView.getUint16(65);
        sensors['lightBumperRight'] = dataView.getUint16(67);
        sensors['irOpcodeLeft'] = dataView.getUint8(69);
        sensors['irOpcodeRight'] = dataView.getUint8(70);
        sensors['leftMotorCurrent'] = dataView.getInt16(71);
        sensors['rightMotorCurrent'] = dataView.getInt16(73);
        //sensors['mainBrushCurrent'] = dataView.getInt16(75);
        //sensors['sideBrushCurrent'] = dataView.getInt16(77);
        sensors['stasis'] = dataView.getUint8(79);
        sensors['timestamp'] = Date.now();
        sensors['counter'] = counter++;
        sensors['packetErr'] = packetErr;
        sensors['checksumErr'] = checksumErr;
        sensors['lastActuator'] = lastActuator;
        sensors['lastUser'] = lastUser;
        log(sensors)
    })
});

function reset() {
    console.log('reset')
    setTimeout(stopStreaming, 0);
    setTimeout(start, 30);
    setTimeout(() => port.drain(), 60)
    setTimeout(() => port.write(Buffer.from([7])), 90);
}

function toggleRTS() {
    log('toggleRTS')
    port.get(console.error, console.log);
    port.set({ rts: true }, console.error);
    setTimeout(() => port.set({ rts: false }, console.error), 500);
    //port.write(Buffer.from([7]));
}

function start() {
    log('start')
    port.write(Buffer.from([128]));
}

async function safe() {
    log('safe')
    port.write(Buffer.from([131]));
}

function full() {
    log('full')
    port.write(Buffer.from([132]));
}

function stop() {
    log('stop')
    port.write(Buffer.from([173]));
}

function power() {
    log('power')
    port.write(Buffer.from([133]));
}

function clean() {
    log('clean')
    port.write(Buffer.from([135]));
}

function dock() {
    log('dock')
    port.write(Buffer.from([143]));
}

function halt() {
    log('halt')
    port.write(Buffer.from([146, 0, 0, 0, 0]));
}

function getSensors() {
    log('getSensors')
    port.write(Buffer.from([142, 100]));
}

function streamSensors() {
    port.write(Buffer.from([148, 1, 100]));
}

function stopStreaming() {
    port.write(Buffer.from([150, 0]));
}

async function drive(left, right) {
    if (sensors.openInterfaceMode < 2) {
        await safe();
        //Pause for at least 15ms to have safe mode take effect
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    const buffer = new ArrayBuffer(5);
    const view = new DataView(buffer);
    view.setInt8(0, 145) // drive command
    view.setInt16(1, right); // 2s complement for left wheel
    view.setInt16(3, left); // 2s complement for right wheel
    log('drive', Buffer.from(buffer))
    port.write(Buffer.from(buffer));
}

async function drivePWM(left, right) {
    if (sensors.openInterfaceMode < 2) {
        safe();
        //Pause for at least 15ms to have safe mode take effect
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    const buffer = new ArrayBuffer(5);
    const view = new DataView(buffer);
    view.setInt8(0, 146) // drive command
    view.setInt16(1, left); // 2s complement for left wheel
    view.setInt16(3, right); // 2s complement for right wheel
    //console.log('drivePWM', Buffer.from(buffer))
    port.write(Buffer.from(buffer));
}

app.all('/toggleRTS', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    toggleRTS();
    res.send(sensors);

});

app.all('/dock', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    dock();
    res.send();

});

app.all('/drive', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    let v = req.query;
    if (Object.keys(v).length == 0) v = JSON.parse(req.body);
    drive(v.left, v.right);
    res.send();

});

app.all('/drivePWM', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    let v = req.query;
    if (Object.keys(v).length == 0) v = JSON.parse(req.body);
    drivePWM(v.left, v.right);
    res.send();

});
var lastTime = 0;
app.all('/phone', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    phoneSensors = req.query || req.body;
    //console.log(phoneSensors,req.body)
    //console.log(JSON.stringify(req.body));
    const thisTime = phoneSensors.locationHeadingTimestamp_since1970;
    //console.log(thisTime,lastTime)
    if (thisTime < lastTime) {
        lastTime = thisTime;
        console.log('out of sync')
        return
    }
    lastTime = thisTime;
    for (key in phoneSensors) {
        //if (key == 'locationTrueHeading' || key == 'thisTime' || key == 'batteryState') {
        sensors[key] = phoneSensors[key]; // copies each property to the objCopy object
        //}
        // console.log(sensors);
    }
    sensors['thisTime'] = phoneSensors[thisTime]; // copies each property to the objCopy object
    res.send(JSON.stringify(sensors));
});

app.all('/img', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");

    // if (phoneSensors == {}) phoneSensors = req.body;
    //const image = decodeURIComponent(req.body)
    console.dir(req.body);
    sensors['img'] = req.body; // copies each property to the objCopy object
    res.send(JSON.stringify(sensors));
});

app.all('/safe', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    safe();
    res.send(JSON.stringify(sensors));
});
app.all('/full', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    full();
    res.send(JSON.stringify(sensors));
});

app.all('/start', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    start();
    res.send(JSON.stringify(sensors));
});

app.all('/stop', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    stop();
    res.send(JSON.stringify(sensors));
});

app.all('/power', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    power();
    res.send(JSON.stringify(sensors));
});

var singTimeouts = [];

function clearSingTimeouts() {
    singTimeouts.forEach((t) => clearTimeout(t));
    singTimeouts = [];
}

function singWhen(song, t) {
    const timeout = setTimeout(() => {
        console.log(song, t)

        port.write(Buffer.from(song)); //store song
        port.write(Buffer.from([141, 0])); //play
    }, t) //play song 
    singTimeouts.push(timeout);
}
app.all('/sing', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    let notes = req.query.song || JSON.parse(req.body).song;
    log(notes)
    notes = notes.replace(/\s/g, ''); //remove white space
    if (notes[1] != '[') notes = '[' + notes + ']'; //add outer brackets if user left out

    //clearSingTimeouts() //Shoud we stop other songs in the list?
    var arr = JSON.parse(notes);
    len = arr.length;
    let timeToPlay = 0;
    while (arr.length > 0) {
        arr.length > 16 ? len = 16 : len = arr.length;
        const payload = [140, 0, len];
        let duration = 0; //Can be used for dividing song into pieces
        for (let i = 0; i < len; i++) {
            payload.push(Math.round(arr[i][0]));
            payload.push(Math.round(arr[i][1]));
            duration += arr[i][1] * (.016) * 1000;
        }
        singWhen(payload, timeToPlay);
        timeToPlay += duration;
        arr.splice(0, len); //reduce song length by queued notes
    }
    res.send();
});
var moveTimeouts = [];

function danceWhen(move, t) {
    const timeout = setTimeout(() => {
        console.log('danceWhen', move, t)
        drive(move[0], move[1]);
    }, t)
    moveTimeouts.push(timeout);
}
app.all('/dance', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const dance = req.query.dance || JSON.parse(req.body).dance;
    log(dance)
    dance = dance.replace(/\s/g, ''); //remove white space
    if (dance[1] != '[') dance = '[' + dance + ']'; //add outer brackets if user left out

    //clearTimeouts() //Shoud we stop other dances in the list?
    var arr = JSON.parse(dance);
    const timeToDance = 0;
    var payload = [];
    for (const i = 0; i < arr.length; i++) {
        payload = [];
        payload.push(Math.round(arr[i][0]));
        payload.push(Math.round(arr[i][1]));
        danceWhen(payload, timeToDance);
        timeToDance += arr[i][2];
    }
    res.send();
});

app.all('/sensors', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    // console.log(sensors);
    res.send(sensors);
});


app.all('/all', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(JSON.stringify(sensors));
});

app.all('/reset', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    reset();
    res.send(JSON.stringify(sensors));
});


function shutdown() {
    start(); //put in passive mode
    setTimeout(stopStreaming, 20);
    setTimeout(stop, 40); //put in off mode
    setTimeout(() => port.drain(), 60)
    setTimeout(() => { port.close(() => { process.exit(0) }) }, 80)
}

app.use('', express.static('public', { 'index': false }), serveIndex('public', { 'icons': true }))

var server = http.createServer(app);
const serverPort = 3001;
server.listen(serverPort);
console.log('listening on port', serverPort)

var wss = new WebSocketServer({ server: server });
wss.on('connection', function(ws) {
    var id = setInterval(function() {
        ws.send(JSON.stringify(sensors), function() { /* ignore errors */ });
    }, 30);
   // console.log('connection to client',id);
    ws.on('close', function() {
        //console.log('closing client',id);
        clearInterval(id);
    });
});

setTimeout(start, 0);
setTimeout(() => port.drain(), 100)
setTimeout(streamSensors, 200);
setTimeout(safe, 300); //Make 300ms to hear beep, 100ms to not


//const senseTimeout = setInterval(getSensors, 1000)
//For control-c
process.on('SIGINT', shutdown);