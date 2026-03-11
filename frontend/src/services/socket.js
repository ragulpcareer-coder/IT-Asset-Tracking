import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

export const socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: {}
});

export const setSocketUserIdentity = (userId) => {
    socket.auth = { ...(socket.auth || {}), userId: userId || undefined };
    if (socket.connected) {
        socket.disconnect();
    }
    if (userId) {
        socket.connect();
    }
};
