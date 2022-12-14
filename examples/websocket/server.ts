import Websocket, { WebSocketServer } from "ws";
import { Middleware } from "../../src/index";

const wss = new WebSocketServer({ port: 8080 });

const handlers = {
  add: async (a: number, b: number) => a + b,
  sub: async (a: number, b: number) => a - b,
  callbackExample: async (a: number, onRes: (b: number) => void) => {
    setTimeout(() => onRes(a ** 2), 1000);
  },
  subscribeToNotifications: async (onNotification: (a: number) => void) => {
    const int = setInterval(() => {

      console.log("SENDING NUMBER")
      onNotification(Math.random())
    }, 1000);
    return {
      unsubscribe: () => {
        console.log("Unsubscribing")
        clearInterval(int)
      }
    };
  },
  throws: async () => {
    throw new Error("catchIt")
  }
};
export type H = typeof handlers;

wss.on("connection", (ws: Websocket) => {
  new Middleware(
    {
      send: (data) => ws.send(data),
      onMessage: (callback) => ws.on("message", callback),
    },
    handlers
  );
});
