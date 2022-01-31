export function getUUIDfromUrl(url: string) {
    return ((a) => a[a.length - 1]?.split('&')?.find(a=>a.trim().startsWith('_id'))?.split('=')[1]?.trim())(url.split('/?')) || undefined
}
export function getDataFromMessage(message: string, key: string) {
    return message.split('&').find((a)=>a.startsWith(key))?.replace(`${key}={`,'').slice(0, -1)
}
export function parseMessage(event: string, data: unknown[]): string {
    return `EventName={${event}}&Data={${encodeURIComponent(JSON.stringify(data))}}`
}
export function parseEvent(message: string): { event: string, data: unknown[] } {
    return { event: getDataFromMessage(message, 'EventName')!, data: JSON.parse(decodeURIComponent(getDataFromMessage(message, 'Data')!)) }
}