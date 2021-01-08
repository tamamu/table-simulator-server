export const selectComponent = (send, componentId) => {
    send(JSON.stringify({
        'type': 'SelectComponent',
        'payload': {
            'component_id': componentId
        }
    }))
}

export const unselectComponent = (send, componentId) => {
    send(JSON.stringify({
        'type': 'UnselectComponent',
        'payload': {
            'component_id': componentId
        }
    }))
}

export const openComponent = (send, componentId) => {
    send(JSON.stringify({
        'type': 'OpenComponent',
        'payload': {
            'component_id': componentId
        }
    }))
}

export const closeComponent = (send, componentId) => {
    send(JSON.stringify({
        'type': 'CloseComponent',
        'payload': {
            'component_id': componentId
        }
    }))
}

export const moveComponent = (send, componentId, x, y) => {
    send(JSON.stringify({
        'type': 'MoveComponent',
        'payload': {
            'component_id': componentId,
            'x': x,
            'y': y
        }
    }))
}

export const incrementComponent = (send, componentId) => {
    send(JSON.stringify({
        'type': 'IncrementComponent',
        'payload': {
            'component_id': componentId,
        }
    }))
}

export const decrementComponent = (send, componentId) => {
    send(JSON.stringify({
        'type': 'DecrementComponent',
        'payload': {
            'component_id': componentId,
        }
    }))
}
