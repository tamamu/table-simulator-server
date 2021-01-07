import * as React from 'react'
import {useState, useEffect, useRef} from 'react'
import * as ReactDOM from 'react-dom'
import styled from 'styled-components'

const Info = styled.h1`
    color: ${props => ['red', 'green', 'blue'][(props.playerNumber - 1)]};
`

const Rect = styled.div`
    position: absolute;
    display: block;
    width: ${props => props.width}px;
    height: ${props => props.height}px;
    left: ${props => props.x}px;
    top: ${props => props.y}px;
    background: ${props =>
        props.hidden || !props.isOpened ?
            'black'
            : (props.image ? `url("${props.image}")` : `rgba(220, 220, 220, 0.8)`)
        };
    border: 4px solid;
    border-color: ${props =>
        props.selectability && props.isSelected ?
            (props.user ? ['red', 'green', 'blue'][(props.user - 1) % 2] : 'transparent')
            : 'transparent'
        };
`

const initialTable = {components: []}

const tableReducer = (table, action) => {
    switch (action.type) {
        case 'UPDATE_COMPONENT':
            let components = [...table.components]
            components[action.payload.componentId] = action.payload.component
            return {components}
        case 'SET_TABLE':
            console.log("update table!")
            return action.payload.table
        default:
            return table
    }
}

const App = () => {
    const [table, dispatchTable] = React.useReducer(tableReducer, initialTable)
    const [playerNumber, setPlayerNumber] = useState()
    const socketRef = useRef()
    const hbRef = useRef(Date.now())

    useEffect(() => {
        console.log(table)
    }, [table])

    useEffect(() => {
        const socket = new WebSocket(`ws://${location.host}/ws/`)
        socket.addEventListener('open', _ => {
            //socket.send('hi!')
        })
        socket.addEventListener('error', event => {
            console.error(`WebSocket error: `, event)
        })
        socket.addEventListener('close', _ => {
            console.log('closed!')
        })
        socket.addEventListener('message', event => {
            console.info('Message from server ', event.data)
            try {
                let notifications = JSON.parse(event.data)
                notifications.forEach(notif => {
                    switch(notif.type) {
                        case 'PlayerNumber':
                            setPlayerNumber(notif.payload.player_number)
                            break
                        case 'Table':
                            dispatchTable({type: 'SET_TABLE', payload: {table: notif.payload.table}})
                            break
                        case 'UpdateComponent':
                            dispatchTable({type: 'UPDATE_COMPONENT', payload: {
                                componentId: notif.payload.component_id,
                                component: notif.payload.component
                            }})
                            break
                        default:
                            console.info(notif.type)
                            break
                    }
                })
            } catch (error) {
                console.error(error)
            }
            
        })
        socketRef.current = socket
    }, [])

    const notifySelectComponent = (componentId) => {
        socketRef.current.send(JSON.stringify({
            'type': 'SelectComponent',
            'payload': {
                'component_id': componentId
            }
        }))
    }

    const notifyUnselectComponent = (componentId) => {
        socketRef.current.send(JSON.stringify({
            'type': 'UnselectComponent',
            'payload': {
                'component_id': componentId
            }
        }))
    }

    const notifyOpenComponent = (componentId) => {
        socketRef.current.send(JSON.stringify({
            'type': 'OpenComponent',
            'payload': {
                'component_id': componentId
            }
        }))
    }

    const notifyCloseComponent = (componentId) => {
        socketRef.current.send(JSON.stringify({
            'type': 'CloseComponent',
            'payload': {
                'component_id': componentId
            }
        }))
    }

    const notifyMoveComponent = (componentId, x, y) => {
        socketRef.current.send(JSON.stringify({
            'type': 'MoveComponent',
            'payload': {
                'component_id': componentId,
                'x': x,
                'y': y
            }
        }))
    }

    const notifyIncrementComponent = (componentId) => {
        socketRef.current.send(JSON.stringify({
            'type': 'IncrementComponent',
            'payload': {
                'component_id': componentId,
            }
        }))
    }

    const notifyDecrementComponent = (componentId) => {
        socketRef.current.send(JSON.stringify({
            'type': 'DecrementComponent',
            'payload': {
                'component_id': componentId,
            }
        }))
    }

    const componentClickFactory = component => ev => {
        switch (component.role) {
            case 'Text':
                if (component.selectability && (component.user === null || component.user === playerNumber)) {
                    if (component.is_selected) {
                        notifyUnselectComponent(component.id)
                    } else {
                        notifySelectComponent(component.id)
                    }
                }
                break
            case 'Counter':
                if (component.user === null || component.user === playerNumber) {
                    notifyIncrementComponent(component.id)
                }
                break
        }
    }

    const componentContextmenuFactory = component => ev => {
        ev.preventDefault();
        switch (component.role) {
            case 'Text':
                if (component.user === null || component.user === playerNumber) {
                    if (component.is_opened) {
                        notifyCloseComponent(component.id)
                    } else {
                        notifyOpenComponent(component.id)
                    }
                }
                break
            case 'Counter':
                if (component.user === null || component.user === playerNumber) {
                    notifyDecrementComponent(component.id)
                }
                break
        }
    }

    const componentDragFactory = (component, force_notify = false) => ev => {
        if (component.user != null && component.user != playerNumber) {
            return
        }
        const x = ev.clientX - component.w/2
        const y = ev.clientY - component.h/2
        
        const newComponent = {...component, x, y}
        dispatchTable({type: 'UPDATE_COMPONENT', payload: {componentId: component.id, component: newComponent}})

        if (force_notify || Date.now() - hbRef.current > 50) {
            hbRef.current = Date.now()
            notifyMoveComponent(component.id, x, y)
        }
    }

    return (
    <div>
        <Info playerNumber={playerNumber}>Player {playerNumber}</Info>
        {table.components.map(component => {
            const hidden = component.hide_others && component.user != playerNumber
            return (
            <Rect onClick={componentClickFactory(component)}
                  onContextMenu={componentContextmenuFactory(component)}
                  draggable="true"
                  onDrag={componentDragFactory(component)}
                  onDragEnd={componentDragFactory(component, true)}
                  id={component.id}
                  key={component.id}
                  number={component.number}
                  image={component.image}
                  selectability={component.selectability}
                  isOpened={component.is_opened}
                  isSelected={component.is_selected}
                  hidden={hidden}
                  x={component.x}
                  y={component.y}
                  width={component.w}
                  height={component.h}
                  user={component.user}>{hidden ? "" : (component.role === 'Text' ? component.text : component.role === 'Counter' ? component.number : "")}</Rect>
            )
        }
        )}
    </div>
    )
}

ReactDOM.render(<App />, document.getElementById('root'))