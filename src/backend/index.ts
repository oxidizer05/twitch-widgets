import express from "express";
import fs from "fs";
import http from "http";
import path from "path";

process.on("uncaughtException", (err) => {
    fs.writeFileSync("crash.log", err.message);
});

import { log, logError } from "./src/helpers";
import { vote, voteList, draw, say } from "./src/twitch";
import { config, isRailway } from "./src/pkg-config";
import { initRealtimeServer, publishDrawWinner } from "./src/realtime";
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

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime()
    });
});

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

        if (!draw.canSelectWinner()) {
            res.status(409).send("The prize drawing is still active!");
            return;
        }

        const winnerWasSelected = draw.hasSelectedWinner();
        const winner = draw.getRandomWinner();
        res.send(winner ?? "");

        if (!winnerWasSelected) {
            publishDrawWinner({ winner: winner ?? "", data: draw.getData() });

            if (winner && config.commands.draw.winnerMessage)
                say(config.twitch.login, `/w ${winner} ${config.commands.draw.winnerMessage}`, true);
        }
    }
    else
        res.status(503).send("The prize drawing is not started yet!");
});

const server = http.createServer(app);

initRealtimeServer(server);

server.listen(config.twitch.httpPort, "0.0.0.0", () => {
    const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    if (publicDomain)
        log(`Public web server URL: https://${publicDomain}`);
    else
        log(`Local web server URL: http://localhost:${config.twitch.httpPort}`);
});
/*
|==========================================================================
| SHARE LOCALHOST ENVIRONMENT
|==========================================================================
*/
import ngrok from "@raz1el/ngrok";
import { processSsh } from "./src/ssh";

if (!isRailway && config.ngrok.enable) {
    config.ngrok.addr = config.twitch.httpPort;
    ngrok.connect(config.ngrok).then(url => { log("Public web server URL: " + url) }).catch(logError);
}
else if (!isRailway && config.sshForward.enable)
    processSsh();
else if (!isRailway)
    log("Public web server URL: disabled");

