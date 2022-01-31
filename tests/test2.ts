import { NetSocketClient, NetSocket } from '../mod.ts'



const netServer = new NetSocket({ serve: { port: 5000 } })
console.log('ww')

netServer.on('connect', (socket) => {
    socket.on('uwu', (...data) => {
        console.log(`server1: `, ...data)
        socket.emitBroadcast('uwu', `${socket.uuid}`)
    })
    netServer.emit('uwu', `${socket.uuid} connected`)
})



const net = new NetSocketClient({ connection: { hostname: 'localhost', port: 5000 } })
net.on('connect', () => {
    net.emit('uwu', { data: 'client1' })
})
net.on('uwu', (...data) => {
    console.log(`client1: `, ...data)
})



const net2 = new NetSocketClient({ connection: { hostname: 'localhost', port: 5000 } })
net2.on('connect', () => {
    net.emit('uwu', { data: 'client2' })
})
net2.on('uwu', (...data) => {
    console.log(`client2: `, ...data)
})