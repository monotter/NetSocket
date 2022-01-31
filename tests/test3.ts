import { NetSocketClient, NetSocket } from '../mod.ts'




console.log('ww')

setTimeout(() => {
    const netServer = new NetSocket({ serve: { port: 5000 } })
    netServer.on('connect', (socket) => {
        socket.on('uwu', (...data) => {
            console.log(`server1: `, ...data)
            socket.emitBroadcast('uwu', `${socket.uuid}`)
        })
        netServer.emit('uwu', `${socket.uuid} connected`)
    })
}, 5000)



const net = new NetSocketClient({ connection: { hostname: 'localhost', port: 5000 } })
let c = 0
net.on('connect', () => {
    setInterval(() => {
        net.emit('uwu', { data: 'client1', c: ++c })
    },500)
})