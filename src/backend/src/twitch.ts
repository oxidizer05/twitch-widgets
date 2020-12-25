import tmi from "tmi.js";
import { REGEX_COMMAND_LINE, REGEX_QUOTES } from "@raz1el/util";
import VotePoll from "./commands/vote";
import Draw from "./commands/draw";
import { removeCommandPrefix, log, logError } from "./helpers";
import { config } from "./pkg-config";

export let vote: VotePoll | undefined;
export let voteList: string | undefined;
export let draw: Draw | undefined;

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

    let args = removeCommandPrefix(message.trim()).match(REGEX_COMMAND_LINE);
    if (!args)
        return;

    args = args.map(s => s.replace(REGEX_QUOTES, ""));
    const command = args.shift();

    if (!command)
        return;

    const access = hasAccess(userState, username, command);

    if (!access && command !== config.commands.draw.name) {
        log(`user: ${username} has no access to the ${command} command`);
        return;
    }

    log(`user: ${username}, command: ${command}, args: ${args}`);

    switch (command) {
        case config.commands.vote.name: {
            if (vote) {
                log("The vote has ended");
                say(channel, "/me " + vote.getWinnerMessage());
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
            }
            break;
        }
        case config.commands.draw.name: {
            if (draw && draw.add(username))
                return;

            if (!access)
                return;

            const errorMessage = Draw.isInvalidParams(args);

            if (errorMessage)
                say(channel, `@${username} ` + errorMessage);
            else {
                draw = new Draw(args);
                say(channel, `@${username} ` + draw.getStartMessage());
                log(`Prize drawing status is available at: http://localhost:${config.twitch.httpPort}/draw.html`);
            }
            break;
        }
        case config.commands.drawstart.name: {
            if (draw) {
                log("The draw has started!");
                draw.start();
                say(channel, "/me " + draw.getStartedMessage());
                return;
            }
            break;
        }
        case config.commands.drawstop.name: {
            if (draw) {
                log("The draw has stopped!");
                draw = undefined;
                return;
            }
            break;
        }
        default: {
            if (vote) {
                switch (command) {
                    case vote.name.condidateA: {
                        vote.vote(username, vote.name.condidateA);
                        break;
                    }
                    case vote.name.condidateB: {
                        vote.vote(username, vote.name.condidateB);
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
    // @ts-ignore
    if (config.commands[command] && config.commands[command].accessFlag)
        // @ts-ignore
        return (config.commands[command].accessFlag & AccessFlags.Mod) && (userState.mod || userState["user-type"] === "mod") || username.toLowerCase() === config.twitch.login.toLowerCase();
    return true;
}

export function say(channel: string, message: string, ignoreNotify?: boolean) {
    if (ignoreNotify || config.commands.notify)
        client.say(channel, message).catch(logError);
}
