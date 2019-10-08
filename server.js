const Discord = require('discord.js');
var express = require('express');
var app = express();
var fs = require("fs");
var jmespath = require('jmespath');
var bodyParser = require('body-parser')
var debug = false;
var path = require('path')
var channel;
var admin;
var auth = require('./JSON/auth.json')
var adminID = require('./JSON/adminID.json')
app.use(bodyParser.json());
const bot = new Discord.Client();
bot.login(auth.token);
bot.on('ready', () => {
    serverType = "dev"
    console.log(`Logged in as ${bot.user.tag}!`);
    runningState = bot.user.username + " running in " + serverType
    admin = bot.users.get(adminID.adminID);
    channel = admin
    channel.send(runningState)
    
});

app.get('/version', function (req, res) {
    res.end('0.0.2');
})
app.get('/download', function (req, res) {
    //currentVersion = fs.readFileSync('./load.py', 'utf8');
    var options = {
        root: path.join(__dirname, './'),
        dotfiles: 'deny',
        headers: {
            'x-timestamp': Date.now(),
            'x-sent': true
        }
    }
    res.sendFile("load.py", options, function (err) {
        if (err) {
            console.log(err)
        } else {
            console.log('Sent:', "load.py")
        }
    })
})
app.get('/load.py', function (req, res) {
    //currentVersion = fs.readFileSync('./load.py', 'utf8');
    var options = {
        root: path.join(__dirname, './'),
        dotfiles: 'deny',
        headers: {
            'x-timestamp': Date.now(),
            'x-sent': true
        }
    }
    res.sendFile("load.py", options, function (err) {
        if (err) {
            console.log(err)
        } else {
            console.log('Sent:', "load.py")
        }
    })
})
app.post('/events', function (req, res) {
    event = req.body
    filename = './JSON/events_' + event.timestamp.replace(/\:/g, "-") + '.json';
    var responseString = "";
    if (event.event == "MissionCompleted") {
        for (f = 0; f <= event.FactionEffects.length - 1; f++) {
            var faction = event.FactionEffects[f].Faction
            if (faction == faction) {
                

                channel.sendMessage(responseString);
                res.end(JSON.stringify("OK "));
            }
        }
    } else if (event.event == "Docked") {
        systems = require('./JSON/systems.json')
        CMDR = event.commandername
        searchString = '[? systemAddress == `' + event.SystemAddress + '`].StarSystem'
        results = jmespath.search(systems, searchString)
        if (results.length == 0) {
            newSystem = {
                "systemAddress": event.SystemAddress,
                "StarSystem": event.StarSystem
            }
            systems.push(newSystem)
            fs.writeFile('./JSON/systems.json', JSON.stringify(systems), 'utf8', function (err) {
                if (err) throw err;
            });
        }
        if (debug) {
            responseString = CMDR + " has docked at " + event.StationName + " in " + event.StarSystem
            var user = bot.users.get('353894762761289728');
            user.sendMessage(responseString);
        }
        res.end(JSON.stringify("OK"));
    } else if (event.event == "SellExplorationData" || event.event == "MultiSellExplorationData") {
        CMDR = event.commandername
        station = event.currentStation
        system = event.currentSystem
        responseString = CMDR + " has sold " + event.TotalEarnings + " CR with of Carto data at " + station + " in " + system


        channel.sendMessage(responseString);
        res.end(JSON.stringify("OK"));

    } else if (debug && event.event == "Undocked") {
        systems = require('./JSON/systems.json')
        CMDR = event.commandername
        responseString = CMDR + " has undocked from " + event.StationName
        var user = bot.users.get('353894762761289728');
        user.sendMessage(responseString);
        res.end(JSON.stringify("OK"));
    } else if (debug && event.event == "MissionAccepted") {
        filename = './JSON/MissionCompleted_' + event.timestamp.replace(/\:/g, "-") + '.json';
        res.end(JSON.stringify("OK"));
    } else if (debug) {
        filename = './JSON/Event_' + event.timestamp.replace(/\:/g, "-") + '.json';
        fs.writeFile(filename, JSON.stringify(event), 'utf8', function (err) {
            if (err) throw err;
            console.log('File is created successfully.');
            res.end(JSON.stringify("OK"));
        });
        res.end(JSON.stringify("OK"));
    } else if(event.event == "Bounty"){

    
    } else {
        res.end(JSON.stringify("Sure"));
    }
})
var port = process.env.PORT || 80
var server = app.listen(port, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("FactionGist is listening at http://%s:%s", host, port)
    console.log(server.address())
});