const Discord = require('discord.js');
var express = require('express');
var app = express();
var fs = require("fs");
var jmespath = require('jmespath');
var bodyParser = require('body-parser')
var debug = false;
let request = require('sync-request');
var path = require('path')
var channel;
var admin;
var auth = require('./JSON/auth.json')
var adminID = require('./JSON/adminID.json')
var allFactions = [];
var eventsToListenFor = [];
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

dirname = './factions/'
fs.readdir(dirname, function (err, filenames) {
    if (err) {
        console.log(err);
        return;
    }
    filenames.forEach(function (filename) {
        fs.readFile(dirname + filename, 'utf-8', function (err, content) {
            if (err) {
                console.log(err);
                return;
            }
            JSONcontent = JSON.parse(content).Actions
            for (J = 0; J <= JSONcontent.length - 1; J++) {
                if (JSONcontent[J].LocationsAreaOfEffect.toString().toLowerCase() != "") {
                    eventsToListenFor.push(JSONcontent[J].Event)
                    console.log(JSON.stringify(eventsToListenFor))
                    addToLocations = [];
                    for (S = 0; S <= JSONcontent[J].LocationsScope.length - 1; S++) {
                        searchString = "https://www.edsm.net/api-v1/" + JSONcontent[J].LocationsShapeAreaOfEffect.toString().toLowerCase() + "-systems?systemName=" + JSONcontent[J].LocationsScope[S] + "&size=" + JSONcontent[J].LocationsAreaOfEffect
                        var res = request('GET', searchString);
                        response = JSON.parse(Buffer.from(res.body).toString())
                        for (R = 0; R <= response.length - 1; R++) {
                            addToLocations.push(response[R].name)
                        }
                    }
                    //JSONcontent[J].LocationsScope = JSONcontent[J].LocationsScope.concat(addToLocations)
                    //console.log(JSON.stringify(addToLocations))
                    //return
                }
            }
            allFactions.push(JSON.parse(content));
        });
    });
});



app.get('/version', function (req, res) {
    res.end('0.0.2b');
})
app.get('/download', function (req, res) {
    //currentVersion = fs.readFileSync('./load.py', 'utf8');
    var options = {
        root: path.join(__dirname, './Plugin'),
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
    console.log(JSON.stringify(allFactions))
    var options = {
        root: path.join(__dirname, './Plugin'),
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
    var event = req.body
    filename = './JSON/events_' + event.timestamp.replace(/\:/g, "-") + '.json';

    console.log("Event received " + req.body.event)

    if (event.event == "Docked") {
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
    }

    console.log(JSON.stringify(event))
    searchString = '[*].Actions[? Event == `"' + event.event + '"`]'
    var results = jmespath.search(allFactions, searchString)
    sendMessage = false
    // if (eventsToListenFor.includes(event.event)) {

    for (a = 0; a <= results.length - 1; a++) {
        console.log("Factions want to know about this event")
        for (b = 0; b <= results[a].length - 1; b++) {
            try {
                who = results[a][b].Who //Who can report to this faction
                if (who == "everyone"  ||  event.reportingFaction.includes(who)) { //Everyone or faction only
                    LocationsToCheck = results[a][b].LocationsToCheck //position in event JSON location is at
                    systemAddress = jmespath.search(event, LocationsToCheck) //assume is systemAddress
                    resolveNameSearch = resolveSystemName(systemAddress) //then convert to System Name 
                    if (results[a][b].LocationsScope.includes(resolveNameSearch)) { 
                        try {
                            message = replaceVariables(results[a][b].Message, event)
                            server = results[a][b].ServerChannel
                            when = results[a][b].When.toString().toLowerCase()
                            sendMessaage(message, server, when)
                        } catch (a) {
                            console.log("Not send message action")
                        }
                        try {
                            SaveDataBasedOn = results[a][b].SaveDataBasedOn
                            saveString = ""
                            for (s = 0; s <= SaveDataBasedOn.length - 1; s++) {
                                saveString +=  replaceVariables(SaveDataBasedOn[s], event)
                            }
                            server = results[a][b].ServerChannel
                            saveString += server
                            
                            console.log(saveString)
                            
                            
                        } catch (a) {
                            console.log("Not send message action")
                        }
                    }
                }
            }
            catch (e) {
                console.log("An error occured", e)
            }
        }
    }
    console.log("End")
    res.end(JSON.stringify("OK"));
})
function replaceVariables(message, inputJSON) {

    do {
        if ((message.indexOf("$") == -1)) { break }

        var variable = message.toString().match(/\$[^\s\,\|\/]*/)[0].replace("$", "")
        var searchString = "@." + variable
        var results = jmespath.search(inputJSON, searchString)
        if (results == null) { continue }
        results = (resolveSystemName(results) || results)
        message = message.replace("$" + variable, results)
        console.log(message)

    } while (message.indexOf("$") > 0)


    return message

}

function resolveSystemName(systemAddress) {
    systems = require('./JSON/systems.json')
    resolveNameSearch = '[? systemAddress == `' + systemAddress + '` ||  StarSystem == `"' + systemAddress + '"`].StarSystem'
    system = jmespath.search(systems, resolveNameSearch)[0]
    return system || systemAddress;
}

function sendMessage(message, server, when) {
    if (when == "now") {
        console.log("sending now")
        console.log(message)
        channel = bot.channels.get(server);
        channel.sendMessage(message);
    }
}

var port = process.env.PORT || 80
var server = app.listen(port, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("FactionGist is listening at http://%s:%s", host, port)
    console.log(server.address())
});