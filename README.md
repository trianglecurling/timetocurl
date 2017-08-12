# Time To Curl
***Time To Curl*** is a node web server that manages timers for curling matches, as well as a client interface to display and manage those timers. Using Web Sockets, we sync clients with all updates in real-time.

## Goals of this project
- Facilitate easy timekeeping for multiple curling matches
- Allow easy display of one or more time clocks
- Extremely low latency
- Automatic generation of game log
- Full audit log

## Features (including planned features)
- Client-server timer model - allows multiple clients to view a timer
- Instantaneous updates
- Fully configurable, but still works out of the box
- Easy error correction
- Replay an end at the touch of a button
- Automatic generation of game log (PDF)
- Full audit log
- Fault-tolerant - can recover even after a network outage
- Auto-scaling UI fits the given screen size
- Supports multiple concurrent timers
- Choose between basic timing (simple countdown) and WCF official timing (active timekeeper required)
- Keyboard shortcuts (configurable tbd)

## Screenshots

### Main UI
![Main ui](assets/main-ui.png)

Classic theme is familiar to experienced timekeepers.

### Between ends UI.
![Between ends](assets/between-end-time-ui.png)

Includes controls for adjusting time during breaks such as timeouts, between ends, and mid-game.

### Synchronized timers
![Synchronized timers](assets/synchronized-ui.png)

Timers are always perfectly synchronized between browsers, even on multiple machines.

## Installing and running Time to Curl
There are plans to run this application on a public server with a domain name. Until then, you must host it yourself. To do that, follow these instructions (Windows):

1. Download and install NodeJS from https://nodejs.org. Make sure you leave all the defaults checked during installation.
2. Either [download](https://github.com/trianglecurling/timetocurl/archive/master.zip) and extract the Time to Curl zip, or clone the repository using Git.
3. Open a command prompt and navigate to the Time to Curl directory (i.e. the directory containing this README.md file).
4. Type `npm install` and press Enter.
5. **Type `node index.js` and press Enter.

At this point the program is running. You can open a web browser and navigate to http://localhost:3001 to use it. **From now on, to run Time to Curl, you only need to do step 5 above from within the application directory in a command prompt.

## Curl with Curl...
You can update timers with basic HTTP requests (i.e. using curl). Eventually I will have all the commands documented. Here's an example for now.

**Add time to a basic timer**  
`curl -XPOST -H "Content-type: application/json" -d '{"action": {"request":"QUERY_TIMER","options":{"command":"ADD_TIME","data":"{\"value\":nn}","timerId":"xxxxx"}}}' 'server-uri'`

Replace `nn` with the number of seconds to add to the timer.  
Replace `xxxxx` with the timer ID (look in the URL).  
Replace `server-uri` with the URI to the server.

**Example**  
`curl -XPOST -H "Content-type: application/json" -d '{"action": {"request":"QUERY_TIMER","options":{"command":"ADD_TIME","data":"{\"value\":60}","timerId":"13586"}}}' 'http://localhost:3001/'`

**Start a basic timer**  
`curl -XPOST -H "Content-type: application/json" -d '{"action": {"request":"QUERY_TIMER","options":{"command":"START_TIMER","timerId":"xxxxx"}}}' 'server-uri'`

**Pause a basic timer**  
`curl -XPOST -H "Content-type: application/json" -d '{"action": {"request":"QUERY_TIMER","options":{"command":"PAUSE_TIMER","timerId":"xxxxx"}}}' 'server-uri'`

## Remaining tasks
- [x] Fix *loaded* timers not working (30 min?)
- [x] Show remaining timeouts for each team (30 min)
- [x] Show the elapsed time for current thinking session (30 min)
- [x] Implement extra ends (45 min)
- [x] Implement time/state adjustments (3 hrs)
- [x] Implement coach travel time for timeouts (1 hr)
- [x] Implement a UI for selecting timer options (super custom configuration) (3 hrs)
- [x] Implement presets for 6, 8, 10 end games, and mixed doubles (1 hr)
- [ ] Implement a read-only mode (1 hr)
- [ ] Implement some kind of token security (3 hrs)
- [ ] Implement one or two new themes (8+ hrs)
- [ ] Implement audit log (1 hr)
- [ ] Implement generation of official game log (4 hrs)
- [ ] Implement an end-of-game experience (1 hr)
- [ ] Figure out how to handle no remaining timeouts (30 min)
- [ ] Allow configuration of colors (1 hr)
- [ ] Keyboard shortcuts (2 hr)
- [ ] Testing, fit and finish (∞ hrs)

**Total: 28+ hours**

*Hofstadter's Law: It always takes longer than you expect, even when you take into account Hofstadter's Law.*
