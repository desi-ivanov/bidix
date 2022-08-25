import Websocket from 'ws'
import type { H } from "./server";
import { Consumer } from "../../src/index";

const ws = new Websocket('ws://localhost:8080')

ws.on("open", () => {

  const middleware = Consumer<H>({
    send: (data) => ws.send(data),
    onMessage: (callback) => ws.on('message', callback)
  });

  middleware.add(1, 2).then(r => console.log("Add res", r));
  middleware.sub(1, 2).then(r => console.log("Sub res", r));
  middleware.callbackExample(7, (r) => console.log("Callback example", r));
  middleware.subscribeToNotifications((r) => console.log("Got Notification", r));

}); 
