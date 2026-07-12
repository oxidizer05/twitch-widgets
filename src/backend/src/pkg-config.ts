import fs from "fs";
import path from "path";

import { Config } from "./types";

export const isPkg = __dirname.includes("snapshot");
export const rootPath = path.normalize(isPkg ? path.dirname(process.execPath) : (__dirname + "/../../../"));
export const configPath = path.join(rootPath, "config.json");
export const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

const defaults = {
    debug: {
        twitch: false,
        fakeUsers: false
    },
    twitch: {
        password: "",
        login: "",
        httpPort: 3000,
        ircPort: 443
    },
    commands: {
        prefix: "!",
        notify: true,
        vote: { name: "vote", accessFlag: 3 },
        draw: { name: "draw", winnerMessage: "Ты победил в розыгрыше!", accessFlag: 3 },
        drawstop: { name: "drawstop", accessFlag: 3 },
        drawstart: { name: "drawstart", accessFlag: 3 }
    },
    ngrok: { enable: false },
    sshForward: { enable: false, reconnect: 1000 }
} as Config;

const fileConfig = readFileConfig();
const configFromFile = mergeConfig(defaults, fileConfig);

export const config: Config = {
    ...configFromFile,
    debug: {
        twitch: envBoolean("DEBUG_TWITCH", configFromFile.debug.twitch),
        fakeUsers: envBoolean("DEBUG_FAKE_USERS", configFromFile.debug.fakeUsers)
    },
    twitch: {
        login: envString("TWITCH_LOGIN", configFromFile.twitch.login),
        password: envString("TWITCH_PASSWORD", envString("TWITCH_OAUTH_TOKEN", configFromFile.twitch.password)),
        httpPort: envNumber("PORT", configFromFile.twitch.httpPort),
        ircPort: envNumber("TWITCH_IRC_PORT", configFromFile.twitch.ircPort)
    },
    commands: {
        ...configFromFile.commands,
        prefix: envString("COMMAND_PREFIX", configFromFile.commands.prefix),
        notify: envBoolean("COMMAND_NOTIFY", configFromFile.commands.notify),
        vote: {
            ...configFromFile.commands.vote,
            name: envString("VOTE_COMMAND", configFromFile.commands.vote.name)
        },
        draw: {
            ...configFromFile.commands.draw,
            name: envString("DRAW_COMMAND", configFromFile.commands.draw.name),
            winnerMessage: envString("DRAW_WINNER_MESSAGE", configFromFile.commands.draw.winnerMessage ?? "")
        },
        drawstart: {
            ...configFromFile.commands.drawstart,
            name: envString("DRAW_START_COMMAND", configFromFile.commands.drawstart.name)
        },
        drawstop: {
            ...configFromFile.commands.drawstop,
            name: envString("DRAW_STOP_COMMAND", configFromFile.commands.drawstop.name)
        }
    },
    ngrok: {
        ...configFromFile.ngrok,
        enable: isRailway ? false : configFromFile.ngrok.enable
    },
    sshForward: {
        ...configFromFile.sshForward,
        enable: isRailway ? false : configFromFile.sshForward.enable
    }
};

validateConfig(config);

function readFileConfig(): Partial<Config> {
    if (!fs.existsSync(configPath))
        return {};

    try {
        return JSON.parse(fs.readFileSync(configPath, { encoding: "utf8" })) as Partial<Config>;
    }
    catch (error) {
        throw new Error(`Failed to read configuration file ${configPath}: ${String(error)}`);
    }
}

function mergeConfig(base: Config, value: Partial<Config>): Config {
    return {
        ...base,
        ...value,
        debug: { ...base.debug, ...value.debug },
        twitch: { ...base.twitch, ...value.twitch },
        commands: {
            ...base.commands,
            ...value.commands,
            vote: { ...base.commands.vote, ...value.commands?.vote },
            draw: { ...base.commands.draw, ...value.commands?.draw },
            drawstart: { ...base.commands.drawstart, ...value.commands?.drawstart },
            drawstop: { ...base.commands.drawstop, ...value.commands?.drawstop }
        },
        ngrok: { ...base.ngrok, ...value.ngrok },
        sshForward: { ...base.sshForward, ...value.sshForward }
    };
}

function envString(name: string, fallback: string) {
    const value = process.env[name];
    return value === undefined ? fallback : value.trim();
}

function envNumber(name: string, fallback: number) {
    const rawValue = process.env[name];
    if (rawValue === undefined)
        return fallback;

    const value = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(value) || value < 1 || value > 65535)
        throw new Error(`${name} must be an integer between 1 and 65535`);
    return value;
}

function envBoolean(name: string, fallback: boolean) {
    const rawValue = process.env[name];
    if (rawValue === undefined)
        return fallback;

    const value = rawValue.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(value))
        return true;
    if (["0", "false", "no", "off"].includes(value))
        return false;
    throw new Error(`${name} must be true or false`);
}

function validateConfig(value: Config) {
    const missing: string[] = [];
    if (!value.twitch.login)
        missing.push("TWITCH_LOGIN");
    if (!value.twitch.password)
        missing.push("TWITCH_PASSWORD");

    if (missing.length)
        throw new Error(`Missing Twitch configuration: ${missing.join(", ")}. Set Railway variables or config.json values.`);
}
