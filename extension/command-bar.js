document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('command-input');

    // Handle input submission
    input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
            const text = input.value.trim();
            if (text) {
                try {
                    const response = await fetch('http://localhost:5001/extract', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ text: text })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to extract event details');
                    }

                    const eventDetails = await response.json();
                    
                    // Generate Google Calendar URL
                    const calendarUrl = generateCalendarUrl(eventDetails);
                    
                    // Open calendar in new tab
                    chrome.tabs.create({ url: calendarUrl });
                    
                    // Close the command bar
                    window.close();
                } catch (error) {
                    console.error('Error:', error);
                }
            }
        } else if (e.key === 'Escape') {
            window.close();
        }
    });

    // Close on click outside
    document.body.addEventListener('click', function(e) {
        if (!document.getElementById('command-container').contains(e.target)) {
            window.close();
        }
    });

    function generateCalendarUrl(details) {
        const baseUrl = 'https://calendar.google.com/calendar/u/0/r/eventedit';
        const params = new URLSearchParams({
            text: details.title,
            dates: `${details.date.replace(/-/g, '')}T${details.start_time.replace(':', '')}00/${details.date.replace(/-/g, '')}T${details.end_time.replace(':', '')}00`,
            location: details.location || ''
        });
        return `${baseUrl}?${params.toString()}`;
    }
}); 