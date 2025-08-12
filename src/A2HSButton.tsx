import React, {useState, useEffect, useRef} from 'react'

const A2HSButton = () => {
    const promptRef = useRef<any>(null)

    useEffect(() => {
        const handler = (event: any) => {
            console.log("prompt set", {event})
            promptRef.current = event;
        }
        window.addEventListener('beforeinstallprompt', handler)
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        }
    }, []);

    const handleAddToHomeScreenClick = () => {
        console.log("try to install pwa", { promptRef})
        if (promptRef?.current) {
            //@ts-ignore
            promptRef?.current?.prompt()
            //@ts-ignore
            promptRef?.current?.userChoice.then((choiceResult) => {
                console.log("USER CHOICE")
                if (choiceResult.outcome === 'accepted') {
                    console.log('The app was added to the home screen')
                } else {
                    console.log('The app was not added to the home screen')
                }
            })
        } else {
            // Show instruction for manual installation
            alert('To install this app:\n\n• On Chrome/Edge: Look for the install button in the address bar\n• On Safari: Tap Share → Add to Home Screen\n• On Firefox: Use the Page Actions menu')
        }
    }

    return <button className="a2hsButton" onClick={handleAddToHomeScreenClick} title="Installing this will allow you to use it offline">
        📦 Install as a PWA
    </button>
}

export default A2HSButton;