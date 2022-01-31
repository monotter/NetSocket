// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

function getDataFromMessage(message, key) {
    return message.split('&').find((a)=>a.startsWith(key)
    )?.replace(`${key}={`, '').slice(0, -1);
}
function parseMessage(event, data) {
    return `EventName={${event}}&Data={${encodeURIComponent(JSON.stringify(data))}}`;
}
function parseEvent(message) {
    return {
        event: getDataFromMessage(message, 'EventName'),
        data: JSON.parse(decodeURIComponent(getDataFromMessage(message, 'Data')))
    };
}
class NetSocket {
    socket;
    get _socket() {
        return this._socket;
    }
    events;
    get _events() {
        return this.events;
    }
    _uuid;
    get uuid() {
        return this._uuid;
    }
    #FirstConnected;
    _status;
    get status() {
        return this._status;
    }
    _listeners;
    Timeout;
    #options;
    constructor(options){
        this.#FirstConnected = false;
        this._listeners = new Map();
        this._status = 'connecting';
        this.events = {
            open: ()=>{
                this._status = 'connected';
                if (this.#FirstConnected) {
                    this.#emit('reconnect');
                    this.#emit('connect');
                } else {
                    const pong = ({ uuid  })=>{
                        this.#emit('firstconnect', this);
                        this.#emit('connect');
                        this._uuid = uuid;
                        this.#FirstConnected = true;
                        this.off('pong', pong);
                    };
                    this.on('pong', pong);
                    this.emit('ping');
                }
            },
            close: ()=>{
                this._status = 'connecting';
                const Interval = setInterval(()=>{
                    this.bindSocket(this.generateSocket(this.#options, this.uuid));
                }, 2000);
                const Timeout = setTimeout(()=>{
                    clearInterval(Interval);
                    this.#emit('disconnect', this);
                }, this.Timeout);
                const connect = ()=>{
                    clearInterval(Interval);
                    clearTimeout(Timeout);
                    this.off('connect', connect);
                };
                this.on('connect', connect);
            },
            message: (ev)=>{
                const event = parseEvent(ev.data);
                this.#emit(event.event, ...event.data);
            },
            error: ()=>{
                this.#emit('error', this);
            }
        };
        const _options = {
            Timeout: 10000,
            connection: {
                hostname: 'localhost',
                tls: false,
                path: '/NetSocket',
                port: false
            },
            ...options
        };
        this.on('disconnect', ()=>{
            this._status = 'disconnected';
        });
        this.#options = _options;
        this.Timeout = _options.Timeout;
        this.bindSocket(this.generateSocket(_options));
    }
    generateSocket(options, uuid) {
        if (typeof options.connection === 'string') {
            const url = new URL(options.connection);
            return new WebSocket(`${url.origin}${url.pathname}`, options.protocols);
        } else {
            const host = options.connection;
            const connection = `${host.tls ? 'wss' : 'ws'}://${host.hostname}:${host.port ? host.port : host.port === false ? '' : host.tls ? 443 : 80}${host.path ? host.path : ''}/${uuid ? `?_id=${uuid}` : ''}`;
            return new WebSocket(connection, options.protocols);
        }
    }
    bindSocket(socket) {
        if (this.socket) {
            this.socket.removeEventListener('open', this.events.open);
            this.socket.removeEventListener('close', this.events.close);
            this.socket.removeEventListener('message', this.events.message);
            this.socket.removeEventListener('error', this.events.error);
            this.socket.close();
        }
        this.socket = socket;
        this.socket.addEventListener('open', this.events.open);
        this.socket.addEventListener('close', this.events.close);
        this.socket.addEventListener('message', this.events.message);
        this.socket.addEventListener('error', this.events.error);
    }
    emit(event, ...data) {
        let Interval;
        new Promise((res, rej)=>{
            if (this._status === 'connected' && this.socket.readyState === WebSocket.OPEN) {
                res();
            } else if (this._status === 'disconnected') {
                rej();
            } else {
                Interval = setInterval(()=>{
                    if (this._status === 'connected' && this.socket.readyState === WebSocket.OPEN) {
                        res();
                    } else if (this._status === 'disconnected') {
                        rej();
                    }
                }, 500);
            }
        }).then(()=>this.socket.send(parseMessage(event, data))
        ).catch(()=>console.error('cannot use emit while disconnected.', {
                event,
                data
            })
        ).finally(()=>Interval && clearInterval(Interval)
        );
    }
     #emit(event, ...data) {
        const listeners = this._listeners.get(event);
        listeners?.forEach((callback)=>callback(...data)
        );
        const anyListeners = this._listeners.get('any');
        if (anyListeners) {
            anyListeners.forEach((callback)=>callback(event, ...data)
            );
        }
    }
    on(event1, callback) {
        let Events = this._listeners.get(event1);
        if (!Events) {
            Events = new Set();
            this._listeners.set(event1, Events);
        }
        Events.add(callback);
    }
    off(event2, callback) {
        const Events = this._listeners.get(event2);
        Events?.delete(callback);
        if (Events.size === 0) {
            this._listeners.delete(event2);
        }
    }
}
export { NetSocket as NetSocket };
