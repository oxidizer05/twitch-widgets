import express from "express";
import fs from "fs";
import path from "path";

process.on("uncaughtException", (err) => {
    fs.writeFileSync("crash.log", err.message);
});

import { log, logError } from "./src/helpers";
import { vote, voteList, draw, say } from "./src/twitch";
import { config } from "./src/pkg-config";
// TODO: fix build
/* import pkg from "../../package.json";

log(`${pkg.productName}: ${pkg.version}`); */
/*
|==========================================================================
| HTTP SERVER
|==========================================================================
*/
const app = express();
const PATH = path.join(__dirname, "..", "frontend");

app.use(express.static(PATH));

app.get("/vote/list", (req, res) => {
    if (vote) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.send(vote.getHtmlVotelistPage());
    }
    else if (voteList) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.send(voteList);
    }
    else
        res.status(503).send("The voting is not started yet!");
});

app.get("/api/vote", (req, res) => {
    if (vote) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(vote.getData());
    }
    else
        res.status(503).send("The voting is not started yet!");
});

app.get("/api/draw", (req, res) => {
    if (draw) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(draw.getData());
    }
    else
        res.status(503).send("The prize drawing is not started yet!");
});

app.get("/api/draw/winner", (req, res) => {
    if (draw) {
        res.setHeader("Access-Control-Allow-Origin", "*");

        const winner = draw.getRandomWinner();
        res.send(winner);

        if (winner && config.commands.draw.winnerMessage)
            say(config.twitch.login, `/w ${winner} ${config.commands.draw.winnerMessage}`, true);
    }
    else
        res.status(503).send("The prize drawing is not started yet!");
});

app.listen(config.twitch.httpPort, () => {
    log(`Local web server URL: http://localhost:${config.twitch.httpPort}`);
});
/*
|==========================================================================
| SHARE LOCALHOST ENVIRONMENT
|==========================================================================
*/
import ngrok from "@raz1el/ngrok";
import { processSsh } from "./src/ssh";

if (config.ngrok.enable) {
    config.ngrok.addr = config.twitch.httpPort;
    ngrok.connect(config.ngrok).then(url => { log("Public web server URL: " + url) }).catch(logError);
}
else if (config.sshForward.enable)
    processSsh();
else
    log("Public web server URL: disabled");

