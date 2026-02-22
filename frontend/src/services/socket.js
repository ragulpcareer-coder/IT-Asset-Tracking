import { io } from "socket.io-client";

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const SOCKET_URL = isLocal ? "http://localhost:5000" : "https://it-asset-tracking.onrender.com";

export const socket = io(SOCKET_URL, {
    autoConnect: false,
});
