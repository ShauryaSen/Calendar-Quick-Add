let overlayIsOpen = false;

function createOverlay() {
    const existing = document.getElementById('quick-calendar-overlay-host');
    if (existing) {
        existing.remove();
        overlayIsOpen = false;
        return;
    }

    overlayIsOpen = true;

    const overlayHost = document.createElement('div');
    overlayHost.id = 'quick-calendar-overlay-host';
    document.body.appendChild(overlayHost);

    const shadow = overlayHost.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.25); /* subtler grey */
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
      }

      .container {
        background: #f9f9f9;
        padding: 8px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      }

      .input {
        all: initial;
        font-family: system-ui, sans-serif;
        font-size: 16px;
        padding: 12px 16px;
        border: 1px solid #ccc;
        border-radius: 10px;
        width: 480px;
        background: white;
        color: black;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }

      .input::placeholder {
        color: #888;
      }
    `;

    // Build elements
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const container = document.createElement('div');
    container.className = 'container';

    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.placeholder = 'Meeting every Monday at 2pm...';

    container.appendChild(input);
    overlay.appendChild(container);
    shadow.appendChild(style);
    shadow.appendChild(overlay);

    // Focus input
    input.focus();

    // Input handlers
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const text = input.value.trim();
            if (text) {
                chrome.runtime.sendMessage({
                    action: 'createEvent',
                    text: text
                });
                removeOverlay();
            }
        } else if (e.key === 'Escape') {
            removeOverlay();
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            removeOverlay();
        }
    });
}

function removeOverlay() {
    const overlayHost = document.getElementById('quick-calendar-overlay-host');
    if (overlayHost) {
        overlayHost.remove();
    }
    overlayIsOpen = false;
}

// Toggle overlay on message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showOverlay') {
        if (overlayIsOpen) {
            removeOverlay();
        } else {
            createOverlay();
        }
        sendResponse({ status: 'Overlay toggled' });
        return true; // Indicates async response
    }
});

// Close the overlay when tab loses focus
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && overlayIsOpen) {
        removeOverlay();
    }
});

// Close the overlay when the window loses focus
window.addEventListener('blur', () => {
    if (overlayIsOpen) {
        removeOverlay();
    }
});

// Make sure we remove the overlay if the page changes
window.addEventListener('beforeunload', () => {
    removeOverlay();
});