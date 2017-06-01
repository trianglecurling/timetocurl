# Time To Curl
***Time To Curl*** is a node web server that manages timers for curling matches, as well as a client interface to display and manage those timers. Using Web Sockets, we sync clients with all updates in real-time.

## Goals of this project
- Facilitate easy timekeeping for multiple curling matches
- Allow easy display of one or more time clocks
- Extremely low latency
- Automatic generation of game log
- Full audit log

## Installing and running Time to Curl
There are plans to run this application on a public server with a domain name. Until then, you must host it yourself. To do that, follow these instructions (Windows):

1. Download and install NodeJS from https://nodejs.org. Make sure you leave all the defaults checked during installation.
2. Either [download](https://github.com/trianglecurling/timetocurl/archive/master.zip) and extract the Time to Curl zip, or clone the repository using Git.
3. Open a command prompt and navigate to the Time to Curl directory (i.e. the directory containing this README.md file).
4. Type `npm install` and press Enter.
5. **Type `node index.js` and press Enter.

At this point the program is running. You can open a web browser and navigate to http://localhost:3001 to use it. **From now on, to run Time to Curl, you only need to do step 5 above from within the application directory in a command prompt.

## Remaining tasks
[x] Fix *loaded* timers not working (30 min?) - 27:11
[x] Show remaining timeouts for each team (30 min) - 24:13
[ ] Show the elapsed time for current thinking session (30 min)
[ ] Implement extra ends (45 min)
[ ] Implement time/state adjustments (evantually will include things like "replay this end") (3 hrs)
[ ] Implement coach travel time for timeouts (1 hr)
[ ] Implement a UI for selecting timer options (super custom configuration) (3 hrs)
[ ] Implement presets for 6, 8, 10 end games, and mixed doubles (1 hr)
[ ] Implement a read-only mode (1 hr)
[ ] Implement some kind of token security (3 hrs)
[ ] Implement one or two new themes (8+ hrs)
[ ] Implement audit log (1 hr)
[ ] Implement generation of official game log (4 hrs)
[ ] Implement an end-of-game experience (1 hr)
[ ] Figure out how to handle no remaining timeouts (30 min)
[ ] Testing, fit and finish (∞ hrs)

**Total: 28+ hours**

*Hofstadter's Law: It always takes longer than you expect, even when you take into account Hofstadter's Law.*