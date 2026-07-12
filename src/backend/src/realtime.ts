import http from "http";
import WebSocket, { Server as WebSocketServer } from "ws";

import { log, logError } from "./helpers";
import { DrawData, VoteCandidatesData } from "./types";

type MessagePayload = unknown;

type BroadcastMessage = {
    type: string;
    payload?: MessagePayload;
};

export interface RealtimeSnapshot {
    vote?: VoteCandidatesData;
    draw?: DrawData;
    isVoteActive: boolean;
    isDrawActive: boolean;
}

type SnapshotProvider = () => RealtimeSnapshot;

let webSocketServer: WebSocketServer | undefined;
let snapshotProvider: SnapshotProvider = () => ({
    isDrawActive: false,
    isVoteActive: false
});

const HEARTBEAT_INTERVAL = 30000;

export function initRealtimeServer(server: http.Server) {
    webSocketServer = new WebSocketServer({ server, path: "/ws" });
    webSocketServer.on("connection", (socket) => {
        setupHeartbeat(socket);
        sendSnapshot(socket);
        socket.on("error", (error) => logError("WebSocket client error: " + error));
    });
    webSocketServer.on("close", () => {
        clearHeartbeat();
    });
    webSocketServer.on("error", (error) => logError("WebSocket error: " + error));

    log("Realtime channel ready on /ws");
}

export function registerSnapshotProvider(provider: SnapshotProvider) {
    snapshotProvider = provider;
}

export function publishVoteUpdate(data: VoteCandidatesData) {
    broadcast({ type: "vote:update", payload: data });
}

export function publishVoteEnded(message: { winnerMessage: string; data: VoteCandidatesData }) {
    broadcast({ type: "vote:ended", payload: message });
}

export function publishDrawUpdate(data: DrawData) {
    broadcast({ type: "draw:update", payload: data });
}

export function publishDrawWinner(payload: { winner: string; data: DrawData }) {
    broadcast({ type: "draw:winner", payload });
}

export function publishDrawReset() {
    broadcast({ type: "draw:reset" });
}

function sendSnapshot(socket: WebSocket) {
    try {
        const snapshot = snapshotProvider();
        socket.send(JSON.stringify({ type: "init", payload: snapshot }));
    }
    catch (error) {
        logError("Failed to send snapshot to client: " + error);
    }
}

function broadcast(message: BroadcastMessage) {
    if (!webSocketServer)
        return;

    const payload = JSON.stringify(message);

    for (const client of webSocketServer.clients) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(payload);
            }
            catch (error) {
                logError("Failed to deliver realtime message: " + error);
            }
        }
    }
}

function setupHeartbeat(socket: WebSocket) {
    (socket as WebSocket & { isAlive?: boolean }).isAlive = true;
    socket.on("pong", () => {
        (socket as WebSocket & { isAlive?: boolean }).isAlive = true;
    });
    startHeartbeatTimer();
}

let heartbeatTimer: NodeJS.Timeout | undefined;

function startHeartbeatTimer() {
    if (heartbeatTimer || !webSocketServer)
        return;

    heartbeatTimer = setInterval(() => {
        if (!webSocketServer)
            return;

        for (const client of webSocketServer.clients) {
            const trackedClient = client as WebSocket & { isAlive?: boolean };
            if (trackedClient.isAlive === false) {
                client.terminate();
                continue;
            }

            trackedClient.isAlive = false;
            try {
                client.ping();
            }
            catch (error) {
                logError("Failed to ping client: " + error);
            }
        }
    }, HEARTBEAT_INTERVAL);
}

function clearHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
    }
}
