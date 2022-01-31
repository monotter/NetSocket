import { NetSocket } from '../mod.ts'
const netServer = new NetSocket({ serve: { port: 5000 } })
netServer.on('connect', (socket) => {
    socket.on('uwu', (...data) => {
        console.log(`server1: `, ...data)
        socket.emitBroadcast('uwu', `${socket.uuid}`)
    })
    netServer.emit('uwu', `${socket.uuid} connected`)
})