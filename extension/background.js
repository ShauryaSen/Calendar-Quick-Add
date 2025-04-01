// context menu item
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "CalendarQuickAdd",
        title: "Add to Google Calendar",
        contexts: ["selection"]
    });
});

function generateCalendarUrl(details) {
    const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

    // Format date and time
    const startDateTime = `${details.date.replace(/-/g, '')}T${details.start_time.replace(/:/g, '')}00`;
    const endDateTime = `${details.date.replace(/-/g, '')}T${details.end_time.replace(/:/g, '')}00`;

    const params = new URLSearchParams({
        text: details.title,
        dates: `${startDateTime}/${endDateTime}`,
        details: 'Created via Quick Calendar Extension'
    });

    // Add location if available
    if (details.location) {
        params.append('location', details.location);
    }

    return `${base}&${params.toString()}`;
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
                iconUrl: 'icon.png',
                title: 'Quick Calendar Error',
                message: error.message || 'Failed to create calendar event'
            });
        }
    }
}); 