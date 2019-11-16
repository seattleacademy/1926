var http = require('http');
var express = require('express');
var serveIndex = require('serve-index')

var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.text({ type: "*/*" }))

phoneSensors = {};
var sensors = {};
var counter = 0;

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

var counter = 0;
port.once('open', () => {
    log('open')
    let length = 80;
    const parser = port.pipe(new InterByteTimeout({ interval: 30, maxBufferSize: length }))
    parser.on('data', (data) => {
        if (data.length != 80) {
            //Something other than sensors received
            log(data.length);
            log(length, data.toString('ascii'));
            return;
        }
        let buffer = new Uint8Array(data).buffer;
        let dataView = new DataView(buffer);
        sensors['bumps'] = dataView.getUint8(0);
        sensors['wall'] = dataView.getUint8(1);
        sensors['cliffLeft'] = dataView.getUint8(2);
        sensors['cliffFrontLeft'] = dataView.getUint8(3);
        sensors['cliffFrontRight'] = dataView.getUint8(4);
        sensors['cliffRight'] = dataView.getUint8(5);
        sensors['virtualWall'] = dataView.getUint8(6);
        sensors['overCurrents'] = dataView.getUint8(7);
        sensors['dirtDetect'] = dataView.getUint8(8);
        sensors['unused1'] = dataView.getUint8(9);
        sensors['irOpcode'] = dataView.getUint8(10);
        sensors['buttons'] = dataView.getUint8(11);
        sensors['distance'] = dataView.getInt16(12);
        sensors['angle'] = dataView.getInt16(14);
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
        sensors['unused2'] = dataView.getUint8(35);
        sensors['unused3'] = dataView.getUint16(37);
        sensors['chargerAvailable'] = dataView.getUint8(39);
        sensors['openInterfaceMode'] = dataView.getUint8(40);
        sensors['songNumber'] = dataView.getUint8(41);
        sensors['songPlaying'] = dataView.getUint8(42);
        sensors['oiStreamNumPackets'] = dataView.getUint8(43);
        sensors['velocity'] = dataView.getInt16(44);
        sensors['radius'] = dataView.getInt16(46);
        sensors['velocityRight'] = dataView.getInt16(48);
        sensors['velocityLeft'] = dataView.getInt16(50);
        sensors['encoderCountLeft'] = dataView.getInt16(52);
        sensors['encoderCountRight'] = dataView.getInt16(54);
        sensors['lightBumper'] = dataView.getUint8(56);
        sensors['lightBumperLeft'] = dataView.getUint16(57);
        sensors['lightBumperFrontLeft'] = dataView.getUint16(59);
        sensors['lightBumperCenterLeft'] = dataView.getUint16(61);
        sensors['lightBumperCenterRight'] = dataView.getUint16(63);
        sensors['irOpcodeLeft'] = dataView.getUint8(65);
        sensors['irOpcodeRight'] = dataView.getUint8(66);
        sensors['leftMotorCurrent'] = dataView.getInt16(67);
        sensors['rightMotorCurrent'] = dataView.getInt16(69);
        sensors['mainBrushCurrent'] = dataView.getInt16(71);
        sensors['sideBrushCurrent'] = dataView.getInt16(73);
        sensors['stasis'] = dataView.getUint8(74);
        sensors['timestamp'] = Date.now();
        sensors['counter'] = counter++;
        log(sensors)

    })
});

function reset() {
    log('reset')
    port.write(Buffer.from([7]));
}

function start() {
    log('start')
    port.write(Buffer.from([128]));
}

function safe() {
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

async function drive(left, right) {
    if (sensors.openInterfaceMode < 2) {
        safe();
        //Pause for at least 15ms to have safe mode take effect
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    const buffer = new ArrayBuffer(5);
    const view = new DataView(buffer);
    view.setInt8(0, 145) // drive command
    view.setInt16(1, left); // 2s complement for left wheel
    view.setInt16(3, right); // 2s complement for right wheel
    log('drive', Buffer.from(buffer))
    port.write(Buffer.from(buffer));
}

setTimeout(start, 0);
setTimeout(safe, 300); //Make 300ms to hear beep, 100ms to not

let senseTimeout = setInterval(getSensors, 1000)

app.all('/drive', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    let v = req.query;
    if (Object.keys(v).length == 0) v = JSON.parse(req.body);
    drive(v.left, v.right);
    res.send();

});

app.all('/phone', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    phoneSensors = req.query || JSON.parse(req.body);
    //log(phoneSensors);
    for (key in phoneSensors) {
        sensors[key] = phoneSensors[key]; // copies each property to the objCopy object
    }
    res.send(JSON.stringify(sensors));
});

var singTimeouts = [];

function clearSingTimeouts() {
    singTimeouts.forEach((t) => clearTimeout(t));
    singTimeouts = [];
}

function singWhen(song, t) {
    let timeout = setTimeout(() => {
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
        let payload = [140, 0, len];
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
    let timeout = setTimeout(() => {
        console.log('danceWhen', move, t)
        drive(move[0],move[1]);
    }, t)
    moveTimeouts.push(timeout);
}
app.all('/dance', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    let dance = req.query.dance || JSON.parse(req.body).dance;
    log(dance)
    dance = dance.replace(/\s/g, ''); //remove white space
    if (dance[1] != '[') dance = '[' + dance + ']'; //add outer brackets if user left out

    //clearTimeouts() //Shoud we stop other dances in the list?
    var arr = JSON.parse(dance);
    let timeToDance = 0;
    var payload = [];
    for (let i = 0; i < arr.length; i++) {
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

app.use('', express.static('public', { 'index': false }), serveIndex('public', { 'icons': false }))

var server = http.createServer(app);
const serverPort = 3001;
server.listen(serverPort);
console.log('listening on port', serverPort)

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
    clearTimeout(senseTimeout);
    setTimeout(stop, 20); //put in off mode
    //Assuming that close flushes, check this assumption
    setTimeout(() => { port.close(() => { process.exit(0) }) }, 40)
    //port.close(() => { process.exit(0) });
}
//For control-c
process.on('SIGINT', shutdown);
