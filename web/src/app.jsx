import * as React from 'react'
import {useState, useEffect, useRef} from 'react'
import * as ReactDOM from 'react-dom'
import styled, {css, keyframes} from 'styled-components'

import {useNotificationReducer} from './store'
import {useWebsocket} from './ws'
import {useDragEffect} from './drag'
import * as Remote from './remote'

const Info = styled.h1`
    margin: 0;
    color: ${props => ['red', 'green', 'blue'][(props.playerNumber - 1)]};
    text-shadow: 2px 0 0 black,
    0 2px 0 black,
    -2px 0 0 black,
    0 -2px 0 black;
`

const Hand = styled.div.attrs(props => ({
    style: {
        left: `${props.x}px`,
        top: `${props.y}px`
    },
}))`
    position: absolute;
    z-index: 10000;
    display: block;
    width: 32px;
    height: 32px;
    border-radius: 32px;
    user-select: none;
    pointer-events: none;
    background: ${props => ['red', 'green', 'blue'][(props.playerNumber - 1)]};
    transform: translateX(-50%) translateY(-50%);
    opacity: 0.5;
`

const ClickablePulse = keyframes`
    0% {
        box-shadow: 0px 0px 1px 0px rgba(0, 0, 0, 1);
    }

    40% {
        box-shadow: 0px 0px 24px 0px rgba(0, 0, 0, 0.7);
    }

    100% {
        box-shadow: 0px 0px 32px 10px rgba(0, 0, 0, 0);
    }
`

const ClickableAnimation = props => css`
    ${props.isOwn ? ClickablePulse : null} 2.0s infinite;
`

const CardFront = styled.div`
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 2;
    backface-visibility: hidden;
    border-radius: 10px;
    background: linear-gradient(rgb(250, 250, 250) 0%, rgb(250, 250, 250) 50%, rgb(243, 243, 243));
    box-shadow: 0 0 0 2px gray inset;
    user-select: none;
    display: flex;
    justify-content: center;
    align-items: center;
`

const CardBack = styled.div`
    width: 100%;
    height: 100%;
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    backface-visibility: hidden;
    transform: rotateY(180deg);
    background: green;
    border-radius: 10px;
    user-select: none;
`

const CardInner = styled.div`
    -webkit-transform-style: preserve-3d;
    width: 100%;
    height: 100%;
    transition: 0.3s;

    ${props => props.isClosed ? `
        transform: rotateY(180deg);

        ${CardFront} {
            z-index: 1;
        }

        ${CardBack} {
            z-index: 2;
        }
    ` : ""}

    
    &:before {
        content: "";
        display: block;
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        margin: auto;
        width: 100%;
        height: 100%;
        border-radius: 10px;
        box-sizing: border-box;
        pointer-events: none;
        animation: ${ClickableAnimation};
    }
`

const CardOuter = styled.div`
    position: absolute;
`

const Card = ({front, back, isOpened, isOwn, ...props}) => (
    <CardOuter {...props}>
        <CardInner isClosed={!isOpened} isOwn={isOwn}>
            <CardFront>{front}</CardFront>
            <CardBack>{back}</CardBack>
        </CardInner>
    </CardOuter>
)


const PulseCard = styled(Card).attrs(props => ({
    style: {
        left: `${props.x}px`,
        top: `${props.y}px`
    },
    userColor: ['red', 'green', 'blue'][(props.user - 1) % 2],
    showBorder: props.selectability && props.isSelected && props.user
}))`
    position: absolute;
    display: block;
    width: ${props => props.width}px;
    height: ${props => props.height}px;
    border: 4px solid;
    border-color: ${props => props.showBorder ? props.userColor : 'transparent'};

    &:after {
        content: "${props => props.user}P";
        color: white;
        font-weight: bold;
        background: ${props => props.userColor};
        padding: 1px;
        position: absolute;
        bottom: 100%;
        left: -4px;
        visibility: ${props => props.showBorder ? 'visible' : 'hidden'};
    }
`

const CardBackDetail = styled.div`
    display: block;
    height: 100%;
    background: #32c1fe;
    border-radius: inherit;
    box-shadow: 0 0 0 2px black inset, 0 0 0 8px white inset;

    &:after {
        content: "";
        display: block;
        width: 100%;
        height: 100%;
        background: white;
        transform: rotate(45deg) scale(0.65);
    }
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
    const moveHandTimerRef = useRef(Date.now())

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

    useEffect(() => {
        window.addEventListener('mousemove', ev => {
            if (Date.now() - moveHandTimerRef.current > 50) {
                moveHandTimerRef.current = Date.now()
                Remote.moveOwnHand(sendMessage, ev.clientX, ev.clientY)
            }
        })
    }, [])

    return (
    <div style={{width: '100%', height: '100vh', background: 'linear-gradient(rgb(124, 124, 124), rgb(200, 200, 200))'}}>
        <Info playerNumber={state.playerNumber}>Player {state.playerNumber}</Info>
        <div>
            {Object.entries(state.hands).map(([handId, hand]) => {
                return (
                <Hand key={handId}
                      playerNumber={handId}
                      x={hand.x}
                      y={hand.y}
                      />
                    )
            })}
        </div>
        {Object.entries(state.components).map(([componentId, component]) => {
            const hidden = component.hideOthers && component.user != state.playerNumber
            return (
            <PulseCard onMouseDown={ev => onComponentMouseDown(ev, component, sendMessage)}
                  onContextMenu={ev => ev.preventDefault()}
                  id={component.id}
                  key={component.id}
                  number={component.number}
                  image={component.image}
                  selectability={component.selectability}
                  isOpened={component.isOpened && !hidden}
                  isSelected={component.isSelected}
                  isOwn={component.user === state.playerNumber}
                  hidden={hidden}
                  x={component.x}
                  y={component.y}
                  width={component.w}
                  height={component.h}
                  user={component.user}
                  front={hidden ? "" : (component.role === 'text' ? component.text : component.role === 'counter' ? component.number : "")}
                  back={<CardBackDetail/>}
                  />
            )
        }
        )}
    </div>
    )
}

ReactDOM.render(<App />, document.getElementById('root'))
