from fastapi import Header, HTTPException, Request
from app.db import get_db_conn
from app.models import UserRegistration
import logging
import hashlib
import secrets

def verify_api_key(x_api_key: str = Header(...)):
    """
    Verify that the provided API key exists in the database.
    Raises an HTTPException with status_code 401 if the key is invalid.
    
    Args:
        x_api_key: API key from the request header
        
    Returns:
        True if the API key is valid
        
    Raises:
        HTTPException: If the API key is invalid or database error occurs
    """
    conn = None
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        # Change %s to ? for SQLite
        cur.execute("SELECT 1 FROM users WHERE api_key = ?", (x_api_key,))
        if not cur.fetchone():
            raise HTTPException(status_code=401, detail="Invalid API key")
        return True
    except HTTPException:
        # Re-raise HTTP exceptions for FastAPI to handle
        raise
    except Exception as e:
        # Log the actual error but return a generic message to the client
        logging.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during authentication")
    finally:
        # Ensure connection is closed even if an exception occurs
        if conn:
            conn.close()

def create_or_validate_user(email: str, browser_id: str) -> dict:
    """
    Create a new user or validate an existing one based on email+browser_id pair.
    
    Args:
        email: User's email address
        browser_id: Browser fingerprint
    
    Returns:
        Dictionary containing API key and whether it was newly created
    """
    conn = None
    try:
        conn = get_db_conn()
        if conn is None:
            logging.error("Database connection failed: conn is None")
            raise HTTPException(status_code=500, detail="Database connection error")
        cur = conn.cursor()
        
        # Create a unique identifier by combining email and browser_id
        unique_id = hashlib.sha256(f"{email}:{browser_id}".encode()).hexdigest()
        
        # Check if user already exists with this unique_id
        cur.execute("SELECT api_key FROM users WHERE unique_id = ?", (unique_id,))
        existing_user = cur.fetchone()
        
        if existing_user:
            # User already exists, return their API key
            return {
                "api_key": existing_user[0],
                "is_new": False
            }
        
        # Create a new API key
        api_key = secrets.token_urlsafe(32)
        
        # Insert new user into database
        cur.execute(
            "INSERT INTO users (api_key, email, browser_id, unique_id, daily_count, last_used) VALUES (?, ?, ?, ?, ?, date('now'))",
            (api_key, email, browser_id, unique_id, 0)
        )
        if conn:
            conn.commit()
        
        return {
            "api_key": api_key,
            "is_new": True
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        logging.error(f"User registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing registration")
    finally:
        if conn:
            conn.close()
