export type Serialized =
  | { kind: "raw", data: string | number | boolean | bigint | null | undefined | symbol }
  | { kind: "array", data: Serialized[] }
  | { kind: "object", data: { [key: string]: Serialized } }
  | { kind: "function", data: string }
  | { kind: "unknown", data: unknown }

export type Message =
  | { kind: "request", functionId: string, requestId: string, data: Serialized[] }
  | { kind: "response", requestId: string, data: Serialized }

export type Duplex = {
  send: (data: string) => void
  onMessage: (callback: (data: string) => void) => void
}

export class IdGenerator {
  private counter = 0
  generate = () => String(this.counter++)
}

export class Middleware<
  TProvided extends { [key: string]: (...args: any[]) => Promise<any> },
  TConsumed extends { [key: string]: (...args: any[]) => Promise<any> }
> {
  #id: IdGenerator;
  #callbacks: { [key: string]: (...data: any) => Promise<any> | any } = {};
  proxy = new Proxy<TConsumed>({} as any, { get: (_, prop) => (...args: any[]) => this.invoke(String(prop), ...args) });
  constructor(private readonly duplex: Duplex, handlers: TProvided) {
    this.#id = new IdGenerator();
    this.#callbacks = {};
    this.#initDuplexSubscriber();
    Object.entries(handlers).forEach(([key, value]) => this.onFunction(key, value));
  }
  clean() {
    this.#callbacks = {};
  }
  public onFunction(functionId: string, callback: (...data: any) => Promise<any> | any) {
    this.#callbacks[functionId] = callback;
  }

  #initDuplexSubscriber() {
    this.duplex.onMessage((msg) => {
      const message = JSON.parse(msg) as Message;
      if(message.kind === "request") {
        const { functionId, requestId, data } = message;
        const callback = this.#callbacks[functionId];
        if(callback) {
          Promise.resolve(callback(...data.map(this.deserialize.bind(this)))).then(result => this.sendResponse(requestId, result));
        }
      } else if(message.kind === "response") {
        const { requestId, data } = message;
        const callback = this.#callbacks[requestId];
        if(callback) {
          callback(this.deserialize(data));
        }
      }
    });
  }

  private sendResponse(requestId: string, result: any) {
    this.duplex.send(JSON.stringify({ kind: "response", requestId, data: this.serialize(result) }));
  }

  public invoke(functionId: string, ...data: any[]): Promise<Serialized> {
    return new Promise((resolve) => {
      const requestId = this.#id.generate();
      this.#callbacks[requestId] = resolve;
      this.duplex.send(JSON.stringify({ kind: "request", functionId, requestId, data: data.map(this.serialize.bind(this)) }));
    });
  }

  serialize(data: any): Serialized {
    if(
      data === null ||
      data === undefined ||
      typeof data === "number" ||
      typeof data === "string" ||
      typeof data === "boolean" ||
      typeof data === "bigint" ||
      typeof data === "symbol"
    ) {
      return { kind: "raw", data };
    }
    if(Array.isArray(data)) {
      return { kind: "array", data: data.map((item) => this.serialize(item)) };
    }
    if(typeof data === "object") {
      return { kind: "object", data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, this.serialize(value)])) };
    }
    if(typeof data === "function") {
      const id = this.#id.generate();
      this.#callbacks[id] = data;
      return { kind: "function", data: id };
    }
    return { kind: "unknown", data };
  }

  deserialize(data: Serialized): any {
    switch(data.kind) {
      case "raw": return data.data;
      case "array": return data.data.map((item) => this.deserialize(item));
      case "object": return Object.fromEntries(Object.entries(data.data).map(([key, value]) => [key, this.deserialize(value)]));
      case "function": return (...args: any[]) => this.invoke(data.data, ...args);
      case "unknown": return data.data;
    }
  }
}

export const Consumer = <TConsumed extends { [key: string]: (...args: any[]) => Promise<any> }>(duplex: Duplex) =>
  new Middleware<{}, TConsumed>(duplex, {}).proxy;