CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(32) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    total_games     INT DEFAULT 0,
    total_kills     INT DEFAULT 0,
    best_wave       INT DEFAULT 0,
    best_time       FLOAT DEFAULT 0,
    INDEX idx_username (username)
);

CREATE TABLE IF NOT EXISTS game_sessions (
    id              VARCHAR(36) PRIMARY KEY,
    host_user_id    INT NOT NULL,
    mode            ENUM('solo', 'coop') NOT NULL DEFAULT 'solo',
    status          ENUM('lobby', 'playing', 'finished') NOT NULL DEFAULT 'lobby',
    max_players     TINYINT DEFAULT 4,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP NULL,
    ended_at        TIMESTAMP NULL,
    final_wave      INT DEFAULT 0,
    final_time      FLOAT DEFAULT 0,
    FOREIGN KEY (host_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS session_players (
    session_id      VARCHAR(36) NOT NULL,
    user_id         INT NOT NULL,
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_host         BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (session_id, user_id),
    FOREIGN KEY (session_id) REFERENCES game_sessions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS scores (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    session_id      VARCHAR(36) NOT NULL,
    user_id         INT NOT NULL,
    character_id    VARCHAR(32) NOT NULL,
    weapon_id       VARCHAR(32) NOT NULL,
    kills           INT DEFAULT 0,
    wave_reached    INT DEFAULT 0,
    time_survived   FLOAT DEFAULT 0,
    level_reached   INT DEFAULT 1,
    gold_earned     INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_scores (user_id),
    INDEX idx_leaderboard (wave_reached DESC, time_survived DESC)
);
