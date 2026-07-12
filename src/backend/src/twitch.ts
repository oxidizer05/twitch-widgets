import tmi from "tmi.js";
import { REGEX_COMMAND_LINE, REGEX_QUOTES } from "@raz1el/util";
import VotePoll from "./commands/vote";
import Draw from "./commands/draw";
import { removeCommandPrefix, log, logError } from "./helpers";
import { config } from "./pkg-config";
import {
    publishDrawReset,
    publishDrawUpdate,
    publishVoteEnded,
    publishVoteUpdate,
    registerSnapshotProvider
} from "./realtime";

export let vote: VotePoll | undefined;
export let voteList: string | undefined;
export let draw: Draw | undefined;

registerSnapshotProvider(() => ({
    vote: vote ? vote.getData() : undefined,
    draw: draw ? draw.getData() : undefined,
    isVoteActive: Boolean(vote),
    isDrawActive: Boolean(draw)
}));

enum AccessFlags {
    User,
    Admin,
    Mod
}

const MESSAGE_MAX_CHARS = 96;

const client = tmi.Client({
    options: { debug: config.debug.twitch },
    connection: {
        reconnect: true,
        secure: true,
        port: config.twitch.ircPort
    },
    identity: {
        username: config.twitch.login,
        password: config.twitch.password
    },
    channels: [config.twitch.login]
});

client.connect()
    .then(() => {
        log(`Connected to ${config.twitch.login} Twitch channel`);
    })
    .catch(e => {
        logError("Failed to connect to Twitch channel. Reason: " + e);
    });

client.on("message", (channel, userState, message, self) => {
    const { username } = userState;

    if (self || !username)
        return;

    if (!message.startsWith(config.commands.prefix) || message.length > MESSAGE_MAX_CHARS)
        return;

    const matches = removeCommandPrefix(message.trim()).match(REGEX_COMMAND_LINE);
    if (!matches)
        return;

    const args = matches.map(s => s.replace(REGEX_QUOTES, ""));
    const command = args.shift();

    if (!command)
        return;

    const access = hasAccess(userState, username, command);

    if (!access && command !== config.commands.draw.name) {
        log(`user: ${username} has no access to the ${command} command`);
        return;
    }

    log(`user: ${username}, command: ${command}, args: ${args.join(", ")}`);

    switch (command) {
        case config.commands.vote.name: {
            if (vote) {
                log("The vote has ended");
                const result = vote.getData();
                const winnerMessage = vote.getWinnerMessage();
                say(channel, "/me " + winnerMessage);
                publishVoteEnded({ winnerMessage, data: result });
                voteList = vote.getHtmlVotelistPage();
                vote = undefined;
                return;
            }
            const errorMessage = VotePoll.isInvalidParams(args);

            if (errorMessage)
                say(channel, `@${username} ` + errorMessage);
            else {
                vote = new VotePoll(args);
                say(channel, `@${username} ` + vote.getStartMessage());
                log(`Voting progress bar is available at: http://localhost:${config.twitch.httpPort}/vote.html`);
                publishVoteUpdate(vote.getData());
            }
            break;
        }
        case config.commands.draw.name: {
            if (draw && draw.add(username)) {
                publishDrawUpdate(draw.getData());
                return;
            }

            if (!access)
                return;

            const errorMessage = Draw.isInvalidParams(args);

            if (errorMessage)
                say(channel, `@${username} ` + errorMessage);
            else {
                draw = new Draw(args);
                say(channel, `@${username} ` + draw.getStartMessage());
                log(`Prize drawing status is available at: http://localhost:${config.twitch.httpPort}/draw.html`);
                publishDrawUpdate(draw.getData());
            }
            break;
        }
        case config.commands.drawstart.name: {
            if (draw) {
                log("The draw has started!");
                draw.start();
                say(channel, "/me " + draw.getStartedMessage());
                publishDrawUpdate(draw.getData());
                return;
            }
            break;
        }
        case config.commands.drawstop.name: {
            if (draw) {
                log("The draw has stopped!");
                publishDrawReset();
                draw = undefined;
                return;
            }
            break;
        }
        default: {
            if (vote) {
                switch (command) {
                    case vote.name.condidateA: {
                        if (vote.vote(username, vote.name.condidateA))
                            publishVoteUpdate(vote.getData());
                        break;
                    }
                    case vote.name.condidateB: {
                        if (vote.vote(username, vote.name.condidateB))
                            publishVoteUpdate(vote.getData());
                        break;
                    }
                    default: {
                        log(`Command ${command} not found`);
                    }
                }
            }
            else
                log(`Command ${command} not found`);
        }
    }
});

function hasAccess(userState: tmi.ChatUserstate, username: string, command: string) {
    const commandConfig = [
        config.commands.vote,
        config.commands.draw,
        config.commands.drawstart,
        config.commands.drawstop
    ].find(item => item.name === command);

    if (commandConfig?.accessFlag)
        return Boolean((commandConfig.accessFlag & AccessFlags.Mod) && (userState.mod || userState["user-type"] === "mod") || username.toLowerCase() === config.twitch.login.toLowerCase());
    return true;
}

export function say(channel: string, message: string, ignoreNotify?: boolean) {
    if (ignoreNotify || config.commands.notify)
        client.say(channel, message).catch(logError);
}
