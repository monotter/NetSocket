import { events, NetSocketClientOptions, callback, HostOptions } from './types.ts'
import { getUUIDfromUrl, parseEvent, parseMessage } from './methods.ts'

export class NetSocket {
    private socket!: WebSocket
    get _socket(): WebSocket {
        return this._socket
    }
    private events: events
    get _events(): events {
        return this.events
    }
    private _uuid!: string
    get uuid() {
        return this._uuid
    }
    #FirstConnected: boolean
    private _status: 'connecting' | 'connected' | 'disconnected'
    get status(): 'connecting' | 'connected' | 'disconnected' {
        return this._status
    }
    public readonly _listeners: Map<string, Set<callback>>
    public readonly Timeout: number
    #options: NetSocketClientOptions
    constructor(options?: NetSocketClientOptions) {
        this.#FirstConnected = false
        this._listeners = new Map()
        this._status = 'connecting'
        this.events = {
            open: () => {
                this._status = 'connected'
                if (this.#FirstConnected) {
                    this.#emit('reconnect')
                    this.#emit('connect')
                } else {
                    const pong = ({ uuid }: { uuid: string }) => {
                        this.#emit('firstconnect', this)
                        this.#emit('connect')
                        this._uuid = uuid
                        this.#FirstConnected = true
                        this.off('pong', pong)
                    }
                    this.on('pong', pong)
                    this.emit('ping')
                }
            },
            close: () => {
                this._status = 'connecting'
                const Interval = setInterval(() => {
                    this.bindSocket(this.generateSocket(this.#options, this.uuid))
                }, 2000)
                const Timeout = setTimeout(() => {
                    clearInterval(Interval)
                    this.#emit('disconnect', this)
                }, this.Timeout)
                const connect = () => {
                    clearInterval(Interval)
                    clearTimeout(Timeout)
                    this.off('connect', connect)
                }
                this.on('connect', connect)
            },
            message: (ev) => {
                const event = parseEvent(ev.data)
                this.#emit(event.event, ...event.data)
            },
            error: () => {
                this.#emit('error', this)
            }
        }
        const _options: NetSocketClientOptions = {
            Timeout: 10000,
            connection: {
                hostname: 'localhost',
                tls: false,
                path: '/NetSocket',
                port: false
            },
            ...options
        }
        this.on('disconnect', () => {
            this._status = 'disconnected'
        })
        this.#options = _options
        this.Timeout = _options.Timeout!
        this.bindSocket(this.generateSocket(_options))
    }
    private generateSocket(options: NetSocketClientOptions, uuid?: string): WebSocket {
        if (typeof options.connection === 'string') {
            const url = new URL(options.connection)
            return new WebSocket(`${ url.origin }${ url.pathname }`, options.protocols)
        } else {
            const host: HostOptions = options.connection!
            const connection = `${ host.tls ? 'wss' : 'ws' }://${ host.hostname }:${ host.port ? host.port : host.port === false ? '' : host.tls ? 443 : 80 }${ host.path ? host.path : '' }/${ uuid ? `?_id=${uuid}` : '' }`
            return new WebSocket(connection, options.protocols)
        }
    }
    bindSocket(socket: WebSocket) {
        if (this.socket) {
            this.socket.removeEventListener('open', this.events.open)
            this.socket.removeEventListener('close', this.events.close)
            this.socket.removeEventListener('message', this.events.message)
            this.socket.removeEventListener('error', this.events.error)
            this.socket.close()
        }
        this.socket = socket
        this.socket.addEventListener('open', this.events.open)
        this.socket.addEventListener('close', this.events.close)
        this.socket.addEventListener('message', this.events.message)
        this.socket.addEventListener('error', this.events.error)
    }
    emit(event: string, ...data: unknown[]) {
        let Interval: number
        new Promise<void>((res, rej) => {
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
        .then(() => this.socket.send(parseMessage(event, data)))
        .catch(() => console.error('cannot use emit while disconnected.', { event, data }))
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