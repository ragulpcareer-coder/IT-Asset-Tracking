import { io } from "socket.io-client";

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const fallbackSocketUrl = isLocal ? "http://localhost:5000" : window.location.origin;
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || fallbackSocketUrl).trim().replace(/\/+$/, "");

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
