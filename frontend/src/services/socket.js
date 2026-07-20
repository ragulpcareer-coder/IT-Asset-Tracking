import { io } from "socket.io-client";

const fallbackSocketUrl = window.location.origin;
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
