// Add this at the top of your background.js
console.log('Background script loaded');

// context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
        id: "CalendarQuickAdd",
    title: "Add to Google Calendar",
    contexts: ["selection"]
  });
});

// Function to generate Google Calendar URL with recurrence support
function generateCalendarUrl(details) {
    const baseUrl = 'https://calendar.google.com/calendar/u/0/r/eventedit';
    
    // Format date and time for Google Calendar
    const formatDate = (date, time) => {
        const dateStr = date.replace(/-/g, '');
        const timeStr = time.replace(/:/g, '');
        return `${dateStr}T${timeStr}00`;
    };
    
    // Initialize parameters
    const params = new URLSearchParams({
        text: details.title,
        location: details.location || ''
    });
    
    // Add dates
    params.append('dates', 
        `${formatDate(details.date, details.start_time)}/${formatDate(details.date, details.end_time)}`
    );
    
    // Handle recurrence
    if (details.recurrence) {
        let recurrenceRule = 'RRULE:FREQ=';
        
        switch (details.recurrence.toLowerCase()) {
            case 'daily':
                recurrenceRule += 'DAILY';
                break;
            case 'weekly':
                recurrenceRule += 'WEEKLY';
                break;
            case 'monthly':
                recurrenceRule += 'MONTHLY';
                break;
            case 'yearly':
                recurrenceRule += 'YEARLY';
                break;
            case 'custom':
                // Handle custom recurrence patterns
                recurrenceRule = handleCustomRecurrence(details.recurrence_details);
                break;
        }
        
        // Add count if specified
        if (details.recurrence_count) {
            recurrenceRule += `;COUNT=${details.recurrence_count}`;
        }
        
        // Add until date if specified
        if (details.recurrence_until) {
            const untilDate = details.recurrence_until.replace(/-/g, '');
            recurrenceRule += `;UNTIL=${untilDate}T235959Z`;
        }
        
        params.append('recur', recurrenceRule);
    }
    
    return `${baseUrl}?${params.toString()}`;
}

// Helper function to process custom recurrence patterns
function handleCustomRecurrence(details) {
    if (!details) return 'RRULE:FREQ=DAILY';  // Default fallback
    
    let recurrenceRule = 'RRULE:';
    
    // Extract frequency and day information
    if (details.includes('every day') || details.includes('daily')) {
        recurrenceRule += 'FREQ=DAILY';
    } else if (details.includes('every other day')) {
        recurrenceRule += 'FREQ=DAILY;INTERVAL=2';
    } else if (details.includes('every week') || details.includes('weekly')) {
        recurrenceRule += 'FREQ=WEEKLY';
    } else if (details.includes('every other week') || details.includes('biweekly')) {
        recurrenceRule += 'FREQ=WEEKLY;INTERVAL=2';
    } else if (details.includes('every month') || details.includes('monthly')) {
        recurrenceRule += 'FREQ=MONTHLY';
    } else if (details.includes('every year') || details.includes('yearly') || details.includes('annually')) {
        recurrenceRule += 'FREQ=YEARLY';
    } else {
        // Handle specific days of the week
        const dayMap = {
            'monday': 'MO', 'tuesday': 'TU', 'wednesday': 'WE', 'thursday': 'TH',
            'friday': 'FR', 'saturday': 'SA', 'sunday': 'SU'
        };
        
        // Default to weekly recurrence
        recurrenceRule += 'FREQ=WEEKLY';
        
        // Extract days
        const days = [];
        for (const [dayName, dayCode] of Object.entries(dayMap)) {
            if (details.toLowerCase().includes(dayName)) {
                days.push(dayCode);
            }
        }
        
        if (days.length > 0) {
            recurrenceRule += `;BYDAY=${days.join(',')}`;
        }
    }
    
    return recurrenceRule;
}

// Context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "CalendarQuickAdd") {
        try {
            const selectedText = info.selectionText;
            console.log('Selected text:', selectedText);

            let response;
            try {
                response = await fetch('http://localhost:5001/extract', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ text: selectedText })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server response:', errorText);
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }

                const eventDetails = await response.json();
                console.log('Extracted details:', eventDetails);

                if (!eventDetails || !eventDetails.date || !eventDetails.start_time || !eventDetails.end_time) {
                    throw new Error('Invalid event details received from server');
                }

                const calendarUrl = generateCalendarUrl(eventDetails);
                console.log('Calendar URL:', calendarUrl);

                chrome.tabs.create({ url: calendarUrl });

            } catch (fetchError) {
                console.error('Connection error:', fetchError);
                throw new Error('Could not connect to the server. Make sure the Flask server is running on port 5001.');
            }
        } catch (error) {
            console.error('Error details:', error);
            // Show error to user
            chrome.notifications.create({
                type: 'basic',
                // iconUrl: 'icon.png',
                title: 'Quick Calendar Error',
                message: error.message || 'Failed to create calendar event'
            });
        }
    }
});

// keyboard shorcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-command-bar") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];

            // Skip internal Chrome pages or restricted URLs
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                console.warn("Cannot inject into this page:", tab.url);
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon.png',
                    title: 'Quick Calendar Error',
                    message: 'Command bar cannot be used on this page.'
                });
                return;
            }

            // Inject content script and show overlay
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Script injection error:", chrome.runtime.lastError);
                } else {
                    chrome.tabs.sendMessage(tab.id, { action: 'showOverlay' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError);
    } else {
                            console.log('Response from content script:', response);
                        }
                    });
                }
            });
        });
    }
});

// Handle event creation from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'createEvent') {
        // Use existing fetch logic to create event
        fetch('http://localhost:5001/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ text: request.text })
        })
            .then(response => response.json())
            .then(eventDetails => {
                const calendarUrl = generateCalendarUrl(eventDetails);
                chrome.tabs.create({ url: calendarUrl });
            })
            .catch(error => {
                console.error('Error:', error);
            });
  }
}); 