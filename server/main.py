from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load env variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["chrome-extension://*", "http://localhost:*", "http://127.0.0.1:*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configure Gemini API
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is not set in .env file")

genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash') 

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

# Additional date handling rules taken from @ronthekiehn
def extract_event_details(text):
    today = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""
    Extract event details from the following text and output ONLY a raw JSON object (no markdown, no code blocks) that represents the event for Google Calendar.
    You may use the fact that the current date is {today}.
    Text: "{text}"
    
    Required fields:
    1. title: A concise event title
    2. start_time: Start time in 24-hour format (HH:MM)
    3. end_time: End time in 24-hour format (HH:MM)
    4. date: Date in YYYY-MM-DD format
    
    Optional fields:
    5. location: Location if mentioned
    
    If any information is missing, make reasonable assumptions based on the context.
    For relative dates (like "tomorrow" or "next week"), use the current date as reference. The current
    date is {today}.
    
    Additional Date Handling Rules:
    - If a user says an event is "at" a time, that means the event starts at that time
    - If a user says an event is "from" a time, that means the event starts at that time
    - If a user says an event is "until" a time, that means the event ends at that time
    - If a user says an event is "to" a time, that means the event ends at that time
    - If a user says an event is "between" two times, that means the event starts at the first time and ends at the second time. that includes if they put a "-" between the two times (ie 1-2) means starts at 1, and ends at 2
    - Do not write arbitrary times unless they are specified, ex: 1 is 1:00 or 13:00 depending on context, 1:05 is 1:05
    
    Recurrence Handling Rules:
    - "every day" or "daily" means the event recurs daily
    - "every week" or "weekly" means the event recurs weekly on the same day
    - "every month" or "monthly" means the event recurs monthly on the same date
    - "every year" or "yearly" or "annually" means the event recurs yearly on the same date
    - For specific day patterns like "every Monday" or "every Monday and Wednesday", extract this as a custom recurrence
    - If the recurrence has an end date or a count (e.g., "for 10 weeks" or "until December 31"), capture that information
    - For phrases like "every other week" or "biweekly", set recurrence to "custom" and specify the interval in recurrence_details

    """
    
    try:
        response = model.generate_content(prompt)
        print(f"Raw response: {response.text}")  # Debug log
        
        # Parse the response to get event details
        import json
        try:
            event_details = json.loads(response.text)
            print(f"Parsed event details: {event_details}")  # Debug log
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {str(e)}")  # Debug log
            # If the response isn't valid JSON, create a structured object
            event_details = {
                "title": text[:50] + "...",  # Use first 50 chars of text as title
                "start_time": "09:00",  # Default to 9 AM
                "end_time": "10:00",    # Default to 1 hour duration
                "location": "",
                "date": datetime.now().strftime("%Y-%m-%d")
            }
        
        # Validate required fields
        required_fields = ['title', 'start_time', 'end_time', 'date']
        for field in required_fields:
            if field not in event_details:
                raise ValueError(f"Missing required field: {field}")
        
        return event_details
    except Exception as e:
        print(f"Error extracting event details: {str(e)}")
        return None

@app.route('/extract', methods=['POST', 'OPTIONS'])
def extract():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        print(f"Received text: {text}")  # Debug log
        event_details = extract_event_details(text)
        
        if not event_details:
            return jsonify({"error": "Failed to extract event details"}), 500
        
        return jsonify(event_details)
    
    except Exception as e:
        print(f"Server error: {str(e)}")  # Debug log
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask server on port 5001...")  # Debug log
    app.run(host='localhost', port=5001, debug=True)