# app/ratelimit.py

from datetime import datetime
from fastapi import Header, HTTPException
from app.db import get_db_conn
import logging

def enforce_daily_limit(x_api_key: str = Header(...)):
    """
    Enforce the daily API usage limit for users.
    Raises appropriate HTTP exceptions when limits are reached or authentication fails.
    """
    conn = None
    try:
        today = datetime.now().date()  # Get just the date portion for comparison
        conn = get_db_conn()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cur = conn.cursor()

        # Change %s to ? for SQLite
        cur.execute("SELECT daily_count, last_used FROM users WHERE api_key = ?", (x_api_key,))
        user = cur.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")

        count, last_used = user
        
        # SQLite will store dates as strings, so we need to convert
        if isinstance(last_used, str):
            last_used = datetime.strptime(last_used, "%Y-%m-%d").date()
        elif isinstance(last_used, datetime):
            last_used = last_used.date()
            
        if last_used != today:
            # Change %s to ? for SQLite and use proper date formatting
            cur.execute("UPDATE users SET daily_count = 1, last_used = ? WHERE api_key = ?", 
                      (today.isoformat(), x_api_key))
        elif count >= 50:
            raise HTTPException(status_code=429, detail="Daily limit (50) exceeded")
        else:
            # Change %s to ? for SQLite
            cur.execute("UPDATE users SET daily_count = daily_count + 1 WHERE api_key = ?", 
                      (x_api_key,))

        conn.commit()
        return True
        
    except HTTPException:
        # Re-raise HTTP exceptions for FastAPI to handle
        raise
    except Exception as e:
        # Log the actual error but return a generic message to the client
        logging.error(f"Rate limit error: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail="Internal server error while checking rate limits")
    finally:
        if conn:
            conn.close()
