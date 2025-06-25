# generate_api_key.py

import uuid
import psycopg2
import os
from datetime import datetime
import requests
import logging
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Get database URL from environment variable
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
if not SUPABASE_DB_URL:
    raise EnvironmentError("SUPABASE_DB_URL environment variable is not set")

def get_public_ip():
    """Get the public IP address of the current machine"""
    try:
        response = requests.get("https://api.ipify.org", timeout=5)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        logging.warning(f"Could not determine public IP: {str(e)}")
        return "unknown"

def generate_key():
    """Generate a unique API key"""
    return str(uuid.uuid4())

def register_key():
    """Register a new API key in the database"""
    ip = get_public_ip()
    key = generate_key()
    conn = None

    try:
        conn = psycopg2.connect(SUPABASE_DB_URL)
        cur = conn.cursor()

        # Check for IP abuse
        cur.execute("SELECT attempts FROM ip_logs WHERE ip_address = %s", (ip,))
        row = cur.fetchone()
        
        if row:
            attempts = row[0]
            if attempts >= 1:  #  Allow 1 key per IP (increase from 1 for testing purposes if needed)
                logging.warning(f"Too many API keys requested from IP: {ip}")
                print("Too many API keys created from this IP address.")
                return
            cur.execute("UPDATE ip_logs SET attempts = attempts + 1 WHERE ip_address = %s", (ip,))
        else:
            cur.execute("INSERT INTO ip_logs (ip_address, attempts) VALUES (%s, %s)", (ip, 1))

        # Create API key
        cur.execute("INSERT INTO users (api_key, daily_count, last_used) VALUES (%s, %s, %s)",
                    (key, 0, datetime.now()))

        conn.commit()
        logging.info(f"New API key registered from IP {ip}")
        print("API Key generated successfully!")
        print(f"Your API Key: {key}")
        print("\nImportant: Save this key securely. It will not be shown again.")
        
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        logging.error(f"Database error: {str(e)}")
        print("Error generating API key. Please try again later.")
    finally:
        if conn:
            conn.close()

