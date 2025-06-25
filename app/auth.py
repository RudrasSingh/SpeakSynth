from fastapi import Header, HTTPException
from app.db import get_db_conn
import logging

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
