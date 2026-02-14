/**
 * Typewriter effect options
 */
export interface TypewriterOptions {
    /**
     * Time in milliseconds between each character.
     * @default 50
     */
    speed?: number;

    /**
     * Initial delay in milliseconds before typing starts.
     * @default 0
     */
    initialDelay?: number;

    /**
     * Callback function when typing is complete.
     */
    onComplete?: () => void;
}

/**
 * Applies a typewriter effect to the given element.
 * 
 * @param element The HTMLElement to type into.
 * @param text The text to type.
 * @param options Configuration options.
 * @returns A cleanup function to stop the animation.
 */
export function typeWriter(
    element: HTMLElement,
    text: string,
    options: TypewriterOptions = {}
): () => void {
    const speed = options.speed ?? 80;
    const initialDelay = options.initialDelay ?? 0;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Reset content
    element.textContent = "";

    const startTyping = () => {
        let currentIndex = 0;

        intervalId = setInterval(() => {
            if (currentIndex < text.length) {
                element.textContent += text[currentIndex];
                currentIndex++;
            } else {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                options.onComplete?.();
            }
        }, speed);
    };

    if (initialDelay > 0) {
        timeoutId = setTimeout(startTyping, initialDelay);
    } else {
        startTyping();
    }

    // Return cleanup function
    return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (intervalId) clearInterval(intervalId);
    };
}
