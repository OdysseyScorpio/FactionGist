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
var maths = require("mathjs")
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
        allFactions = jmespath.search(systems, searchString)
        if (allFactions.length == 0) {
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

    for (a = 0; a <= allFactions.length - 1; a++) {
        theFaction = allFactions[a]
        for (b = 0; b <= theFaction.Actions.length - 1; b++) {
            theAction = theFaction.Actions[b]
            try {
                who = theAction.Who //Who can report to this faction
                if (who == "everyone" || event.reportingFaction.includes(who)) { //Everyone or faction only
                    LocationsToCheck = theAction.LocationsToCheck //position in event JSON location is at
                    systemAddress = jmespath.search(event, LocationsToCheck) //assume is systemAddress
                    resolveNameSearch = resolveSystemName(systemAddress) //then convert to System Name 
                    if (theAction.Event == event.event && theAction.LocationsScope.includes(resolveNameSearch)) {
                        sendAMessage = theAction.Message != null
                        saveDataBasedOn = theAction.SaveDataBasedOn != null
                        additionalDataFrom = theAction.AdditionalDataFrom != null

                        if (additionalDataFrom) {
                            try {
                                matchingEventSearchString = '[@.Actions[? Event == `"' + theAction.AdditionalDataFrom + '"`]][0][0]'
                                matchingEvent = jmespath.search(theFaction, matchingEventSearchString)
                                dataBasedOn = matchingEvent.SaveDataBasedOn
                                event.AdditionalDataFrom = theAction.AdditionalDataFrom
                                eventToRetreive = getSavedEventObject(dataBasedOn, event, true)
                                searchString = '[[? matchString == `"' + eventToRetreive.matchString + '"`].event][0][0]'
                                savedEvents = require('./JSON/savedEvents.json')
                                var result = jmespath.search(savedEvents, searchString)
                                event[result.event] = result
                                for(s = 0;s<=savedEvents.length -1 ; s++){
                                    if(savedEvents[s].matchString == eventToRetreive.matchString){
                                        savedEvents.splice(s, 1) 
                                        if(savedEvents.length==0){
                                            stringToSave = []
                                        } else {
                                            stringToSave = JSON.stringify(savedEvents)
                                        }
                                        fs.writeFile('./JSON/savedEvents.json', stringToSave, 'utf8', function (err) {
                                            if (err) throw err;
                                        });
                                        break;
                                    }
                                }
                                event.AdditionalDataFrom = undefined
                            } catch (e) {
                                console.log("Not additionalInfo action")
                            }
                        }
                        if (sendAMessage) {
                            try {
                                message = replaceVariables(theAction.Message, event)
                                server = theAction.ServerChannel
                                when = theAction.When.toString().toLowerCase()
                                sendMessage(message, server, when)
                            } catch (e) {
                                console.log("Not send message action")
                            }
                        }
                        if (saveDataBasedOn) {
                            try {
                                dataBasedOn = theAction.SaveDataBasedOn //[[? Event == `"MarketBuy"`]][0][0]
                                eventToSave = getSavedEventObject(dataBasedOn, event, false)
                                savedEvents = require('./JSON/savedEvents.json')
                                savedEvents.push(eventToSave)
                                fs.writeFile('./JSON/savedEvents.json', JSON.stringify(savedEvents), 'utf8', function (err) {
                                    if (err) throw err;
                                });
                            } catch (e) {
                                console.log("Not send message action")
                            }
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

        var variable = message.toString().match(/\$[^\s\,\|\/\)\()]*/)[0].replace("$", "")
        var searchString = "@." + variable
        var allFactions = jmespath.search(inputJSON, searchString)
        if (allFactions == null) { allFactions = variable }
        allFactions = (resolveSystemName(allFactions) || allFactions)
        message = message.replace("$" + variable, allFactions)
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
    if (message.indexOf("calc(") > -1) {
        mathsString = message.substring(message.indexOf("calc(") + 5, message.indexOf(")", message.indexOf("calc")))
        mathsValue = maths.evaluate(mathsString);
        message = message.replace("calc(" + mathsString + ")", mathsValue)
    }
    if (when == "now") {
        console.log("sending now")
        console.log(message)
        channel = bot.channels.get(server);
        channel.sendMessage(message);
    }
}

function getSavedEventObject(dataBasedOn, event, loadEvent) {
    saveString = ""
    if (loadEvent) {
        eventName = event.event
        loadEvent = event.AdditionalDataFrom
        event.event = loadEvent
        event.AdditionalDataFrom = eventName
    }
    for (s = 0; s <= dataBasedOn.length - 1; s++) {
        saveString += replaceVariables(dataBasedOn[s], event)
    }
    server = theAction.ServerChannel
    saveString += server
    saveString = event.event + saveString
    eventToSave = {
        matchString: saveString,
        event
    }
    if (loadEvent) {
        eventName = event.event
        loadEvent = event.AdditionalDataFrom
        event.event = loadEvent
        event.event = eventName
    }
    return eventToSave
}

var port = process.env.PORT || 80
var server = app.listen(port, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("FactionGist is listening at http://%s:%s", host, port)
    console.log(server.address())
});