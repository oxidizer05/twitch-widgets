export interface VoteCandidates {
    condidateA: string;
    condidateB: string;
}

export interface VoteCount {
    voteCountA: number;
    voteCountB: number;
}

export interface VoteCandidatesData {
    condidateA: VoteData;
    condidateB: VoteData;
    totalVotes: number;
}

export interface VoteData {
    command: string;
    label: string;
    votes: number;
}

export interface DrawData {
    countdownSeconds: number;
    text: string;
    userCount: number;
    command: string;
    endTimestamp: number;
    lastWinner: string;
    winnerSelected: boolean;
}

// Config
export interface Config {
    debug: Debug;
    twitch: Twitch;
    commands: Commands;
    ngrok: NgrokConfig;
    sshForward: SshConfig;
}

export interface Debug {
    twitch: boolean;
    fakeUsers: boolean;
}

export interface Commands {
    prefix: string;
    notify: boolean;
    vote: Command;
    draw: Command;
    drawstop: Command;
    drawstart: Command;
}

export interface Command {
    name: string;
    admin: boolean;
    winnerMessage: string | undefined;
    accessFlag: number;
}

export interface Twitch {
    password: string;
    login: string;
    httpPort: number;
    ircPort: number;
}

export interface SshConfig {
    enable: boolean;
    reconnect: number;
}

// ngrok
import { INgrokOptions } from "@raz1el/ngrok";

export interface NgrokConfig extends INgrokOptions {
    enable: boolean;
}
