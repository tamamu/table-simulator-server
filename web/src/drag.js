import * as React from 'react'

export const useDragEffect = ({
    onDrag = ev => {},
    onDragEnd = ev => {},
}) => {
    const dragTargetRef = React.useRef(null)
    const lazyTargetRef = React.useRef(null)
    const setDragTarget = (target, lazy = 0) => {
        if (lazy > 0) {
            lazyTargetRef.current = target
            return new Promise((_, reject) => {
                setTimeout(() => {
                    if (lazyTargetRef.current !== null) {
                        dragTargetRef.current = target
                        lazyTargetRef.current = null
                    } else {
                        reject()
                    }
                }, lazy)
            })
        } else {
            dragTargetRef.current = target
        }
    }

    const onMouseMove = ev => {
        if (dragTargetRef.current !== null) {
            onDrag({
                target: dragTargetRef.current,
                x: ev.clientX,
                y: ev.clientY
            })
        }
    }

    const onMouseUp = ev => {
        if (lazyTargetRef.current !== null) {
            lazyTargetRef.current = null
        }
        if (dragTargetRef.current !== null) {
            onDragEnd({
                target: dragTargetRef.current,
                x: ev.clientX,
                y: ev.clientY
            })
            dragTargetRef.current = null
        }
    }

    React.useEffect(() => {
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)

        return () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
        }
    }, [])

    return {setDragTarget}
}
