import { ServeInit } from '../depts.ts'
// deno-lint-ignore no-explicit-any
export type events = { close: (ev: CloseEvent) => any, error: (ev: Event) => any, message: (ev: MessageEvent) => any, open: (ev: Event) => any }
// deno-lint-ignore no-explicit-any
export type callback = (...data: any[]) => any
export type ServeOptions = ServeInit & {
    tls?: {
        certFile: string
        keyFile: string
        hostname?: string
    }
}
export type NetSocketOptions = {
    Timeout?: number
    serve?: ServeOptions | number
}
export type HostOptions = {
    hostname: string
    tls?: boolean
    path?: string
    port?: number | `${number}` | false
}
export type NetSocketClientOptions = {
    Timeout?: number
    connection?: string | HostOptions
    protocols?: string | string[]
}

let ws = new WebSocket('localhost:8000')