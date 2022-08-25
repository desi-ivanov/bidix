# bidix
An inter-process communication middleware for simplified bidirectional callbacks management, fully typed.

### WebSocket example
Check [examples/websocket](examples/websocket/) for more details.
#### Server
```ts
import Websocket, { WebSocketServer } from "ws";
import { Middleware } from "bidix";

const wss = new WebSocketServer({ port: 8080 });

const handlers = {
  add: async (a: number, b: number) => a + b,
  sub: async (a: number, b: number) => a - b,
  callbackExample: async (a: number, onRes: (b: number) => void) => {
    setTimeout(() => onRes(a ** 2), 1000);
  },
  subscribeToNotifications: async (onNotification: (a: number) => void) => {
    setInterval(() => onNotification(Math.random()), 1000);
  },
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

```
#### Client
```ts
import Websocket from "ws";
import { Consumer } from "bidix";
import type { H } from "./server";

const ws = new Websocket("ws://localhost:8080");

ws.on("open", () => {
  const middleware = Consumer<H>({
    send: (data) => ws.send(data),
    onMessage: (callback) => ws.on("message", callback),
  });

  middleware.add(1, 2).then((r) => console.log("Add res", r));
  middleware.sub(1, 2).then((r) => console.log("Sub res", r));
  middleware.callbackExample(7, (r) => console.log("Callback example", r));
  middleware.subscribeToNotifications((r) => console.log("Got Notification", r));
});

// Output:
// Add res 3
// Sub res -1
// Callback example 49
// Got Notification 0.7296933890679862
// Got Notification 0.3961023227141208
// Got Notification 0.7218411908449844
// ...
```
