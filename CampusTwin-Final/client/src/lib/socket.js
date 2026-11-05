import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { TOKEN_KEY } from "../api/http";

// One shared socket per browser tab. The token is read again on every (re)connect, so a fresh login is
// used automatically. Socket origin = API origin without the "/api" suffix.
const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API.replace(/\/api\/?$/, "");

let socket = null;
let users = 0;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }),
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });
  }
  return socket;
}

// Subscribe to a list of events while the component is mounted. Returns whether the socket is connected,
// so callers can keep a slower REST poll as a fallback when it is not.
export function useSocketEvents(handlers) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return undefined;
    const s = getSocket();
    users += 1;
    const up = () => setConnected(true), down = () => setConnected(false);
    s.on("connect", up); s.on("disconnect", down); s.on("connect_error", down);
    const entries = Object.entries(handlers || {});
    entries.forEach(([ev, fn]) => s.on(ev, fn));
    if (!s.connected) s.connect(); else setConnected(true);
    return () => {
      entries.forEach(([ev, fn]) => s.off(ev, fn));
      s.off("connect", up); s.off("disconnect", down); s.off("connect_error", down);
      users -= 1;
      if (users === 0) s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return connected;
}
