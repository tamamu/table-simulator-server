import * as React from 'react'

const initialState = {
    playerNumber: 0,
    components: {},
    hands: {},
}

export const useNotificationReducer = () => React.useReducer((state, action) => {
    switch(action.type) {
        case 'connectPlayer':
            return {
                ...state,
                hands: {
                    ...state.hands,
                    [action.payload.playerNumber]: action.payload.hand
                }
            }
            break
        case 'disconnectPlayer':
            const {[action.payload.playerNumber]: _, ...nextHands} = state.hands
            console.log(nextHands)
            return {
                ...state,
                hands: nextHands
            }
            break
        case 'playerNumber':
            console.debug("set player number as ", action.payload.playerNumber)
            return {...state, playerNumber: action.payload.playerNumber}
            break
        case 'setComponents':
            console.debug("set components", action)
            return {...state, components: action.payload.components}
            break
        case 'updateComponent':
            console.debug(`update components[${action.payload.componentId}]: `, action.payload.component)
            return {
                ...state,
                components: {
                    ...state.components,
                    [action.payload.componentId]: action.payload.component
                }
            }
            break
        case 'setHands':
            console.log(action.payload.hands)
            return {
                ...state,
                hands: action.payload.hands
            }
        case 'moveHand':
            console.log("move")
            const prevHand = state.hands[action.payload.playerNumber]
            return {
                ...state,
                hands: {
                    ...state.hands,
                    [action.payload.playerNumber]: {...prevHand, x: action.payload.x, y: action.payload.y}
                }
            }
        default:
            console.log("Unknown notification type: ", action.type)
            return state
            break
    }
}, initialState)
