import * as React from 'react'
import {useState, useEffect, useRef} from 'react'
import * as ReactDOM from 'react-dom'
import styled from 'styled-components'

import {useNotificationReducer} from './store'
import {useWebsocket} from './ws'
import {useDragEffect} from './drag'
import * as Remote from './remote'

const Info = styled.h1`
    color: ${props => ['red', 'green', 'blue'][(props.playerNumber - 1)]};
`

const Rect = styled.div.attrs(props => ({
    style: {
        left: `${props.x}px`,
        top: `${props.y}px`
    }
}))`
    position: absolute;
    display: block;
    width: ${props => props.width}px;
    height: ${props => props.height}px;
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

const onComponentMouseLeft = (state, ev, component, sendMessage) => {
    switch (component.role) {
        case 'text':
            if (component.selectability && (component.user === null || component.user === state.playerNumber)) {
                if (component.isSelected) {
                    Remote.unselectComponent(sendMessage, component.id)
                } else {
                    Remote.selectComponent(sendMessage, component.id)
                }
            }
            break
        case 'counter':
            if (component.user === null || component.user === state.playerNumber) {
                Remote.incrementComponent(sendMessage, component.id)
            }
            break
    }
}

const onComponentMouseMiddle = (state, ev, component, sendMessage) => {

}

const onComponentMouseRight = (state, ev, component, sendMessage) => {
    switch (component.role) {
        case 'text':
            if (component.user === null || component.user === state.playerNumber) {
                if (component.isOpened) {
                    Remote.closeComponent(sendMessage, component.id)
                } else {
                    Remote.openComponent(sendMessage, component.id)
                }
            }
            break
        case 'counter':
            if (component.user === null || component.user === state.playerNumber) {
                Remote.decrementComponent(sendMessage, component.id)
            }
            break
    }
}




const App = () => {
    const [state, dispatch] = useNotificationReducer()
    const hbRef = useRef(Date.now())

    const {sendMessage} = useWebsocket(`ws://${location.host}/ws/`, {
        onOpen: () => {},
        onError: ev => {
            console.error(`WebSocket error: `, ev)
        },
        onClose: () => {},
        onMessage: ev => {
            try {
                let notifications = JSON.parse(ev.data)
                notifications.forEach(notif => {
                    dispatch(notif)
                })
            } catch (error) {
                console.error(error)
            }
        }
    })

    const onMoveComponent = ({target, x, y}, forceNotify = false) => {
        const posX = x - target.w/2
        const posY = y - target.h/2

        // local
        dispatch({
            type: 'updateComponent',
            payload: {
                componentId: target.id,
                component: {...target, x: posX, y: posY}
            }
        })

        if (forceNotify || Date.now() - hbRef.current > 50) {
            hbRef.current = Date.now()
            // remote
            Remote.moveComponent(sendMessage, target.id, posX, posY)
        }
    }

    const {setDragTarget} = useDragEffect({
        onDrag: onMoveComponent,
        onDragEnd: st => onMoveComponent(st, true)
    })

    const onComponentMouseDown = (ev, component, sendMessage) => {
        ev.preventDefault()
        if (component.user != null && component.user != state.playerNumber) {
            return
        }
        // delay dragging to identify whether it is a click or not
        setDragTarget(component, 100).catch(() => {
            switch(ev.button) {
                case 0://left
                    onComponentMouseLeft(state, ev, component, sendMessage)
                    break
                case 1://middle
                    onComponentMouseMiddle(state, ev, component, sendMessage)
                    break
                case 2://right
                    onComponentMouseRight(state, ev, component, sendMessage)
                    break
            }
        })
    }

    return (
    <div>
        <Info playerNumber={state.playerNumber}>Player {state.playerNumber}</Info>
        {Object.entries(state.components).map(([componentId, component]) => {
            const hidden = component.hideOthers && component.user != state.playerNumber
            return (
            <Rect onMouseDown={ev => onComponentMouseDown(ev, component, sendMessage)}
                  onContextMenu={ev => ev.preventDefault()}
                  id={component.id}
                  key={component.id}
                  number={component.number}
                  image={component.image}
                  selectability={component.selectability}
                  isOpened={component.isOpened}
                  isSelected={component.isSelected}
                  hidden={hidden}
                  x={component.x}
                  y={component.y}
                  width={component.w}
                  height={component.h}
                  user={component.user}>{hidden ? "" : (component.role === 'text' ? component.text : component.role === 'counter' ? component.number : "")}</Rect>
            )
        }
        )}
    </div>
    )
}

ReactDOM.render(<App />, document.getElementById('root'))
