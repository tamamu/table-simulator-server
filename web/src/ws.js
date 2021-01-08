import * as React from 'react'

export const useWebsocket = (url, {onOpen = () => {}, onMessage = () => {}, onClose = () => {}, onError = () => {}}) => {
    const socketRef = React.useRef()

    React.useEffect(() => {
        const socket = new WebSocket(url)
        socket.addEventListener('open', onOpen)
        socket.addEventListener('message', onMessage)
        socket.addEventListener('close', onClose)
        socket.addEventListener('error', onError)
        socketRef.current = socket

        return () => {
            socket.close()
        }
    }, [])

    return {
        sendMessage: (message) => {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(message)
            }
        }
    }
}
