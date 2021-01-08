import * as React from 'react'

const initialState = {
    playerNumber: 0,
    components: {},
}

export const useNotificationReducer = () => React.useReducer((state, action) => {
    switch(action.type) {
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
        default:
            console.log("Unknown notification type: ", action.type)
            return state
            break
    }
}, initialState)
