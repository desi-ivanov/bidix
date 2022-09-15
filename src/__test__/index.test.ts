import { Middleware, Duplex, Consumer } from "../index";
class FakeBroadcastServer {
  subs: Record<string, (data: string) => void> = {};
  constructor() { }
  connect(): Duplex {
    const id = Math.random().toString();
    return {
      send: (data) => {
        Object.entries(this.subs).forEach(([oid, f]) => {
          if(oid !== id)
            f(data);
        });
      },
      onMessage: (callback) => {
        this.subs[id] = callback
      }
    }
  }
  clear() {
    this.subs = {};
  }
}

describe("main module", () => {
  const srv = new FakeBroadcastServer();
  beforeEach(() => srv.clear());

  test("promise resolve", () => {
    const funcs = { add: async (a: number, b: number) => a + b };
    const a = new Middleware(srv.connect(), funcs);
    const b = Consumer<typeof funcs>(srv.connect());
    expect(b.add(1, 2)).resolves.toBe(3);
  });


  test("promise reject", () => {
    const funcs = { add: async (a: number, b: number) => { return Promise.reject("should reject") } };
    const a = new Middleware(srv.connect(), funcs);
    const b = Consumer<typeof funcs>(srv.connect());
    return b.add(1, 2).catch(e => expect(e).toBe("should reject"));
  });

  test("callback", () => {
    const funcs = { cb: async (x: number, f: (x: number) => void) => new Promise(r => setTimeout(r, 1)).then(() => f(x)) };
    const a = new Middleware(srv.connect(), funcs);
    const b = Consumer<typeof funcs>(srv.connect());
    const rnd = Math.random();
    return new Promise<number>(resolve => b.cb(rnd, r => resolve(r))).then(res => expect(res).toBe(rnd));
  });

  test("subscription", async () => {
    const funcs = { sub: async (f: (x: number) => void) => { const int = setInterval(() => f(Math.random()), 10); return { unsubscribe: async () => clearInterval(int) } } };
    const a = new Middleware(srv.connect(), funcs);
    const b = Consumer<typeof funcs>(srv.connect());
    let calls = 0;
    const sub = await b.sub(() => calls++);
    await new Promise(r => setTimeout(r, 100));
    await sub.unsubscribe();
    expect(calls).toBeGreaterThan(2);
  });

});
