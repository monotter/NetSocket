import { serve, v4, serveTls } from '../depts.ts'
import { events, NetSocketOptions, callback, ServeOptions } from './types.ts'
import { getUUIDfromUrl, parseEvent, parseMessage } from './methods.ts'
export class SocketInstance {
    private events: events
    protected _listeners: Map<string, Set<callback>>
    private socket!: WebSocket
    public readonly _NetSocket: NetSocket
    public readonly headers: Headers
    public readonly uuid: string
    #FirstConnected: boolean
    private _status: 'connecting' | 'connected' | 'disconnected'
    get status(): 'connecting' | 'connected' | 'disconnected' {
        return this._status
    }
    get _socket(): WebSocket {
        return this.socket
    }
    get _events(): events {
        return this.events
    }
    constructor(NetSocket: NetSocket, socket: WebSocket, headers: Headers, uuid: string, exist?: boolean) {
        this._status = 'connecting'
        this.#FirstConnected = exist ? true : false
        this.uuid = uuid
        this.headers = headers
        this._listeners = new Map()
        this.events = {
            open: () => {
                this._status = 'connected'
                if (this.#FirstConnected) {
                    this.#emit('reconnect', this)
                    this.#emit('connect', this)
                } else {
                    const ping = () => {
                        this.#emit('firstconnect', this)
                        this.#emit('connect', this)
                        this.#FirstConnected = true
                        this.emit('pong', { uuid: this.uuid })
                        this.off('ping', ping)
                    }
                    this.on('ping', ping)
                }
            },
            close: () => {
                this._status = 'connected'
                const Timeout = setTimeout(() => {
                    this.#emit('disconnect', this)
                }, this._NetSocket.Timeout)
                this.on('reconnect', () => {
                    clearTimeout(Timeout)
                })
            },
            error: () => {
                this.#emit('error', this)
            },
            message: (ev) => {
                const event = parseEvent(ev.data)
                this.#emit(event.event, ...event.data)
            },
        }
        this._NetSocket = NetSocket
        this.placeSocket(socket)
        this.on('disconnect', () => {
            this._status = 'disconnected'
        })
    }
    placeSocket(socket: WebSocket) {
        this.socket = socket
        this.socket.addEventListener('open', this.events.open)
        this.socket.addEventListener('close', this.events.close)
        this.socket.addEventListener('message', this.events.message)
        this.socket.addEventListener('error', this.events.error)
    }
    emitBroadcast(event: string, ...data: unknown[]) {
        this._NetSocket._sockets.forEach((socket) => {
            if (socket === this) { return }
            socket.emit(event, ...data)
        })
    }
    emit(event: string, ...data: unknown[]) {
        let Interval: number
        new Promise<void>(async (res, rej) => {
            if (this._status === 'connected' && this.socket.readyState === WebSocket.OPEN) {
                res()
            } else if (this._status === 'disconnected') {
                rej()
            } else {
                Interval = setInterval(() => {
                    if (this._status === 'connected' && this.socket.readyState === WebSocket.OPEN) {
                        res()
                    } else if (this._status === 'disconnected') {
                        rej()
                    }
                }, 500)
            }
        })
        .then(() => this._socket.send(parseMessage(event, data)))
        .catch(() => { })
        .finally(() => Interval && clearInterval(Interval))
    }
    #emit(event: string, ...data: unknown[]) {
        const listeners = this._listeners.get(event)
        listeners?.forEach((callback) => callback(...data))

        const anyListeners = this._listeners.get('any')
        if (anyListeners) {
            anyListeners.forEach((callback) => callback(event, ...data))
        }
    }
    on(event: string | 'any', callback: callback) {
        let Events: Set<callback> = this._listeners.get(event)!
        if (!Events) { Events = new Set(); this._listeners.set(event, Events) }
        Events.add(callback)
    }
    off(event: string, callback: callback) {
        const Events: Set<callback> = this._listeners.get(event)!
        Events?.delete(callback)
        if (Events.size === 0) {
            this._listeners.delete(event)
        }
    }
}
export class NetSocket {
    public readonly _sockets: Map<string, SocketInstance>
    public readonly _listeners: Map<string, Set<callback>>
    public readonly Timeout: number
    constructor(options?: NetSocketOptions) {
        this._sockets = new Map()
        this._listeners = new Map()
        const _options: NetSocketOptions = {
            Timeout: 60000,
            ...options
        }
        this.Timeout = _options.Timeout!
        if (_options.serve) {
            const _serve: ServeOptions = typeof _options.serve === 'number' ? { port: _options.serve } : _options.serve
            if (_serve.tls) {
                serveTls((req: Request) => {
                    if (req.headers.get('upgrade') != "websocket") {
                        return new Response(null, { status: 501 })
                    }
                    const uuid = getUUIDfromUrl(req.url)
                    const { socket, response } = Deno.upgradeWebSocket(req)
                    this.handleSocket(socket, req.headers, uuid)
                    return response
                }, { ..._serve.tls, ..._serve })
            } else {
                serve((req: Request) => {
                    if (req.headers.get('upgrade') != "websocket") {
                        return new Response(null, { status: 501 })
                    }
                    const uuid = getUUIDfromUrl(req.url)
                    const { socket, response } = Deno.upgradeWebSocket(req)
                    this.handleSocket(socket, req.headers, uuid)
                    return response
                }, _serve)
            }
        }
    }
    handleSocket(socket: WebSocket, headers: Headers, uuid: string = '') {
        let _uuid = uuid
        let exist = true
        if (!v4.validate(_uuid)) { _uuid = crypto.randomUUID(); exist = false }
        const existSocket = this._sockets.get(_uuid)
        if (existSocket) {
            existSocket._socket.removeEventListener('open', existSocket._events?.open!)
            existSocket._socket.removeEventListener('close', existSocket._events?.close!)
            existSocket._socket.removeEventListener('message', existSocket._events?.message!)
            existSocket._socket.removeEventListener('error', existSocket._events?.error!)
            existSocket._socket.close()
            existSocket.placeSocket(socket)
        } else {
            const _socket = new SocketInstance(this, socket, headers, _uuid, exist)
            this._sockets.set(_uuid, _socket)
            _socket.on('any', (event: string) => {
                if (['connect', 'reconnect', 'disconnect'].includes(event)) {
                    this.#emit(event, _socket)
                }
                if (event === 'disconnect') {
                    this._sockets.delete(_uuid)
                }
            })
        }
    }
    emit(event: string, ...data: unknown[]) {
        this._sockets.forEach((socket) => socket.emit(event, ...data))
    }
    #emit(event: string, ...data: unknown[]) {
        const listeners = this._listeners.get(event)
        listeners?.forEach((callback) => callback(...data))

        const anyListeners = this._listeners.get('any')
        if (anyListeners) {
            anyListeners.forEach((callback) => callback(event, ...data))
        }
    }
    on(event: 'disconnect', callback: (socket: SocketInstance) => any): any
    on(event: 'reconnect', callback: (socket: SocketInstance) => any): any
    on(event: 'connect', callback: (socket: SocketInstance) => any): any
    on(event: string | 'any', callback: callback) {
        let Events: Set<callback> = this._listeners.get(event)!
        if (!Events) { Events = new Set(); this._listeners.set(event, Events) }
        Events.add(callback)
    }
    off(event: string, callback: callback) {
        const Events: Set<callback> = this._listeners.get(event)!
        Events?.delete(callback)
        if (Events.size === 0) {
            this._listeners.delete(event)
        }
    }
}