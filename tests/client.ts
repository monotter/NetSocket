import { NetSocketClient } from '../mod.ts'
const net = new NetSocketClient({ connection: { hostname: 'localhost', port: 5000 } })
let c = 0
console.log('w')
net.on('connect', () => {
    setInterval(() => {
        net.emit('uwu', { data: 'client1', c: ++c })
    },500)
})