# app/db.py

import os
import sqlite3
import logging
from typing import Optional

# Path to SQLite database file
DB_PATH = os.getenv("SQLITE_DB_PATH", "speaksynth.db")

def get_db_conn() -> Optional[sqlite3.Connection]:
    """
    Creates and returns a SQLite database connection.
    
    Returns:
        A sqlite3 database connection object
        
    Raises:
        RuntimeError: If connection fails
    """
    try:
        # Check if database exists, if not create it with schema
        is_new_db = not os.path.exists(DB_PATH)
        
        # Connect to the database
        conn = sqlite3.connect(DB_PATH)
        
        # Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON")
        
        # Return dictionary-like rows
        conn.row_factory = sqlite3.Row
        
        # Create tables if new database
        if is_new_db:
            create_tables(conn)
            logging.info(f"New database created at {DB_PATH} with schema")
        
        return conn
    except sqlite3.Error as e:
        logging.error(f"SQLite error: {e}")
        raise RuntimeError(f"Database connection error: {str(e)}")

def create_tables(conn):
    """Create the necessary tables if they don't exist"""
    cursor = conn.cursor()
    
    try:
        # Check if users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if cursor.fetchone():
            # Table exists, check its schema
            cursor.execute("PRAGMA table_info(users)")
            columns = {row['name']: row for row in cursor.fetchall()}
            
            # Check for missing columns and add them if needed
            if "unique_id" not in columns:
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN unique_id TEXT")
                    # Update existing rows with a generated unique_id
                    cursor.execute("SELECT email, browser_id, rowid FROM users")
                    for row in cursor.fetchall():
                        email, browser_id, rowid = row
                        unique_id = f"{email}-{browser_id[:16]}"
                        cursor.execute("UPDATE users SET unique_id = ? WHERE rowid = ?", (unique_id, rowid))
                        
                    # Now make it unique
                    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_id ON users(unique_id)")
                except Exception as e:
                    logging.warning(f"Could not add unique_id column: {e}")
            
            logging.info("Users table already exists - schema verified")
            return
    except Exception as e:
        logging.warning(f"Error checking users table: {e}")
        # Continue to create the table from scratch
    
    # Create users table with email and browser_id fields
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        api_key TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        browser_id TEXT NOT NULL, 
        unique_id TEXT NOT NULL UNIQUE,
        daily_count INTEGER DEFAULT 0,
        last_used TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )
    ''')
    
    # Create index on unique_id for faster lookups
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_unique_id ON users(unique_id)
    ''')
    
    # Create index on email for potential lookups
    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_email ON users(email)
    ''')
    
    conn.commit()
    logging.info("Created users table with proper schema")
