-- PaperBull Core Schema Initialization

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    mfa_secret VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'trader',
    github_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cash_balance DECIMAL(18, 4) DEFAULT 100000.0000,
    margin_balance DECIMAL(18, 4) DEFAULT 100000.0000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    average_entry_price DECIMAL(18, 4) NOT NULL,
    side VARCHAR(10) CHECK (side IN ('LONG', 'SHORT')) NOT NULL,
    leverage DECIMAL(5, 2) DEFAULT 1.00,
    stop_loss DECIMAL(18, 4),
    take_profit DECIMAL(18, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, ticker, side)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    price DECIMAL(18, 4),
    type VARCHAR(10) CHECK (type IN ('MARKET', 'LIMIT')) NOT NULL,
    side VARCHAR(20) CHECK (side IN ('BUY', 'SELL', 'SELL_SHORT', 'BUY_TO_COVER')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED')) DEFAULT 'PENDING',
    stop_loss DECIMAL(18, 4),
    take_profit DECIMAL(18, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    price DECIMAL(18, 4) NOT NULL,
    side VARCHAR(20) CHECK (side IN ('BUY', 'SELL', 'BUY_TO_COVER', 'SELL_SHORT')) NOT NULL,
    commission DECIMAL(18, 4) DEFAULT 0.0000,
    execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    display_order INTEGER DEFAULT 0,
    UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS course_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_url VARCHAR(512) NOT NULL,
    progress_percent DECIMAL(5, 2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_url)
);

CREATE TABLE IF NOT EXISTS course_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_url VARCHAR(512) NOT NULL,
    timestamp_seconds INTEGER NOT NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_snapshots (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    net_asset_value DECIMAL(18, 4) NOT NULL,
    cash_balance DECIMAL(18, 4) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
