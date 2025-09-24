const RECONNECT_TIMEOUT = 3000;

function createRealtimeClient(handlers = {}) {
    let socket;
    let reconnectTimer;

    const connect = () => {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const endpoint = `${protocol}://${window.location.host}/ws`;
        socket = new WebSocket(endpoint);

        socket.addEventListener("open", () => {
            clearTimeout(reconnectTimer);
            if (typeof handlers.open === "function")
                handlers.open();
        });

        socket.addEventListener("message", (event) => {
            if (!event.data)
                return;

            let message;
            try {
                message = JSON.parse(event.data);
            }
            catch (error) {
                console.error("Failed to parse realtime payload", error);
                return;
            }

            const { type, payload } = message;

            if (type && typeof handlers[type] === "function")
                handlers[type](payload);
            else if (typeof handlers.message === "function")
                handlers.message(type, payload);
        });

        socket.addEventListener("close", () => {
            if (typeof handlers.close === "function")
                handlers.close();
            scheduleReconnect();
        });

        socket.addEventListener("error", () => {
            socket.close();
        });
    };

    const scheduleReconnect = () => {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, RECONNECT_TIMEOUT);
    };

    connect();

    return {
        disconnect() {
            clearTimeout(reconnectTimer);
            if (socket && socket.readyState === WebSocket.OPEN)
                socket.close();
        }
    };
}

module.exports = createRealtimeClient;
