/**
 * Circular reveal View Transition helper.
 *
 * Problem: if individual elements have CSS `transition` properties (e.g.
 * `transition: background-color 0.3s`), they start animating their own color
 * change the moment the DOM mutates inside the `startViewTransition` callback.
 * The API then captures a "new" snapshot that is *partially mid-transition*,
 * so the circle reveal only covers the elements that already changed — not the
 * full page.
 *
 * Fix: add the `no-transition` class to <html> before mutating the DOM.
 * This forces all elements to snap instantly to their new values, giving the
 * API a clean fully-updated snapshot. After `.finished`, we remove the class
 * so normal hover/focus transitions resume.
 */

export function startCircularReveal(
    e: { clientX: number; clientY: number },
    domMutation: () => void
): void {
    if (typeof document === 'undefined') {
        domMutation();
        return;
    }

    const root = document.documentElement;

    // Firefox and older mobile WebViews do not expose View Transitions. Keep
    // the same duration and colour interpolation there instead of silently
    // changing the entire page in one frame.
    if (!('startViewTransition' in document)) {
        root.classList.add('theme-transition-fallback');
        domMutation();
        window.setTimeout(() => root.classList.remove('theme-transition-fallback'), 560);
        return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${maxRadius}px`);

    const vt = (document as any).startViewTransition(() => {
        // Disable per-element CSS transitions so every element snaps to its new
        // value immediately — giving the API a clean, fully-updated "after" snapshot.
        root.classList.add('no-transition');
        domMutation();
    });

    // Re-enable element transitions after the circle animation completes.
    vt.finished.then(() => root.classList.remove('no-transition'));
}
