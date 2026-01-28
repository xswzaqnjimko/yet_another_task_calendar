// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{State, Manager};
use chrono::Utc;

// Data structures matching the frontend schema
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Task {
    id: String,
    name: String,
    color: String,
    icon: Option<String>,
    group_id: Option<String>,
    sort_order: i32,
    archived: bool,
    description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Occurrence {
    id: String,
    task_id: String,
    date: String,
    status: String,
    title: Option<String>,
    notes: Option<String>,
    repeat_group_id: Option<String>,
    repeating_notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TimeEntry {
    id: String,
    occurrence_id: String,
    task_id: String,
    date: String,
    start_time: String,
    end_time: String,
    duration: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct Settings {
    key: String,
    value: String,
}

// Database state
struct DbState {
    conn: Mutex<Connection>,
    db_path: String,
}

// Initialize database and create tables
fn init_database(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT,
            group_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            description TEXT
        )",
        [],
    )?;

    // Migration: Add description column if it doesn't exist (for existing databases)
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN description TEXT", []);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS task_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS recurrence_rules (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            rule_type TEXT NOT NULL,
            interval INTEGER NOT NULL,
            weekdays TEXT,
            start_date TEXT NOT NULL,
            end_date TEXT,
            max_occurrences INTEGER DEFAULT 100,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS occurrences (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'planned',
            title TEXT,
            notes TEXT,
            repeat_group_id TEXT,
            repeating_notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id),
            UNIQUE(task_id, date)
        )",
        [],
    )?;

    // Migration: Add repeat columns if they don't exist (for existing databases)
    let _ = conn.execute("ALTER TABLE occurrences ADD COLUMN repeat_group_id TEXT", []);
    let _ = conn.execute("ALTER TABLE occurrences ADD COLUMN repeating_notes TEXT", []);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS occurrence_exceptions (
            id TEXT PRIMARY KEY,
            recurrence_rule_id TEXT NOT NULL,
            date TEXT NOT NULL,
            action TEXT NOT NULL,
            FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS time_entries (
            id TEXT PRIMARY KEY,
            occurrence_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            duration INTEGER NOT NULL,
            note TEXT,
            FOREIGN KEY (occurrence_id) REFERENCES occurrences(id),
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_occurrences_date ON occurrences(date)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_occurrences_task ON occurrences(task_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_time_entries_occurrence ON time_entries(occurrence_id)",
        [],
    )?;

    Ok(())
}

// Tauri commands

#[tauri::command]
fn get_tasks(state: State<DbState>) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, color, icon, group_id, sort_order, archived, description FROM tasks ORDER BY sort_order ASC")
        .map_err(|e| e.to_string())?;

    let tasks = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                group_id: row.get(4)?,
                sort_order: row.get(5)?,
                archived: row.get(6)?,
                description: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<Task>>>()
        .map_err(|e| e.to_string())?;

    Ok(tasks)
}

#[tauri::command]
fn create_task(task: Task, state: State<DbState>) -> Result<Task, String> {
    let conn = state.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (id, name, color, icon, group_id, sort_order, archived, description) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        (
            &task.id,
            &task.name,
            &task.color,
            &task.icon,
            &task.group_id,
            &task.sort_order,
            &task.archived,
            &task.description,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(task)
}

#[tauri::command]
fn update_task(task: Task, state: State<DbState>) -> Result<Task, String> {
    let conn = state.conn.lock().unwrap();
    conn.execute(
        "UPDATE tasks SET name = ?1, color = ?2, icon = ?3, group_id = ?4, sort_order = ?5, archived = ?6, description = ?7 WHERE id = ?8",
        (
            &task.name,
            &task.color,
            &task.icon,
            &task.group_id,
            &task.sort_order,
            &task.archived,
            &task.description,
            &task.id,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(task)
}

#[tauri::command]
fn delete_task(task_id: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("DELETE FROM tasks WHERE id = ?1", [&task_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_occurrences(start_date: String, end_date: String, state: State<DbState>) -> Result<Vec<Occurrence>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, task_id, date, status, title, notes, repeat_group_id, repeating_notes, created_at, updated_at FROM occurrences WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC")
        .map_err(|e| e.to_string())?;

    let occurrences = stmt
        .query_map([&start_date, &end_date], |row| {
            Ok(Occurrence {
                id: row.get(0)?,
                task_id: row.get(1)?,
                date: row.get(2)?,
                status: row.get(3)?,
                title: row.get(4)?,
                notes: row.get(5)?,
                repeat_group_id: row.get(6)?,
                repeating_notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<Occurrence>>>()
        .map_err(|e| e.to_string())?;

    Ok(occurrences)
}

#[tauri::command]
fn create_occurrence(occurrence: Occurrence, state: State<DbState>) -> Result<Occurrence, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO occurrences (id, task_id, date, status, title, notes, repeat_group_id, repeating_notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        (
            &occurrence.id,
            &occurrence.task_id,
            &occurrence.date,
            &occurrence.status,
            &occurrence.title,
            &occurrence.notes,
            &occurrence.repeat_group_id,
            &occurrence.repeating_notes,
            &now,
            &now,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(occurrence)
}

#[tauri::command]
fn update_occurrence(occurrence: Occurrence, state: State<DbState>) -> Result<Occurrence, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE occurrences SET status = ?1, title = ?2, notes = ?3, repeat_group_id = ?4, repeating_notes = ?5, updated_at = ?6 WHERE id = ?7",
        (
            &occurrence.status,
            &occurrence.title,
            &occurrence.notes,
            &occurrence.repeat_group_id,
            &occurrence.repeating_notes,
            &now,
            &occurrence.id,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(occurrence)
}

#[tauri::command]
fn delete_occurrence(occurrence_id: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    
    // Delete associated time entries first
    conn.execute("DELETE FROM time_entries WHERE occurrence_id = ?1", [&occurrence_id])
        .map_err(|e| e.to_string())?;
    
    // Delete the occurrence
    conn.execute("DELETE FROM occurrences WHERE id = ?1", [&occurrence_id])
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn get_occurrences_by_repeat_group(repeat_group_id: String, state: State<DbState>) -> Result<Vec<Occurrence>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, task_id, date, status, title, notes, repeat_group_id, repeating_notes, created_at, updated_at FROM occurrences WHERE repeat_group_id = ?1 ORDER BY date ASC")
        .map_err(|e| e.to_string())?;

    let occurrences = stmt
        .query_map([&repeat_group_id], |row| {
            Ok(Occurrence {
                id: row.get(0)?,
                task_id: row.get(1)?,
                date: row.get(2)?,
                status: row.get(3)?,
                title: row.get(4)?,
                notes: row.get(5)?,
                repeat_group_id: row.get(6)?,
                repeating_notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<Occurrence>>>()
        .map_err(|e| e.to_string())?;

    Ok(occurrences)
}

#[tauri::command]
fn update_future_repeat_entries(repeat_group_id: String, from_date: String, title: Option<String>, repeating_notes: Option<String>, state: State<DbState>) -> Result<i32, String> {
    let conn = state.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    
    let count = conn.execute(
        "UPDATE occurrences SET title = ?1, repeating_notes = ?2, updated_at = ?3 WHERE repeat_group_id = ?4 AND date >= ?5",
        (
            &title,
            &repeating_notes,
            &now,
            &repeat_group_id,
            &from_date,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(count as i32)
}

#[tauri::command]
fn delete_future_repeat_entries(repeat_group_id: String, from_date: String, state: State<DbState>) -> Result<i32, String> {
    let conn = state.conn.lock().unwrap();
    
    // First delete time entries for those occurrences
    conn.execute(
        "DELETE FROM time_entries WHERE occurrence_id IN (SELECT id FROM occurrences WHERE repeat_group_id = ?1 AND date >= ?2)",
        [&repeat_group_id, &from_date],
    )
    .map_err(|e| e.to_string())?;
    
    // Then delete the occurrences
    let count = conn.execute(
        "DELETE FROM occurrences WHERE repeat_group_id = ?1 AND date >= ?2",
        [&repeat_group_id, &from_date],
    )
    .map_err(|e| e.to_string())?;

    Ok(count as i32)
}

#[tauri::command]
fn check_occurrence_exists(task_id: String, date: String, state: State<DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT COUNT(*) FROM occurrences WHERE task_id = ?1 AND date = ?2")
        .map_err(|e| e.to_string())?;
    
    let count: i32 = stmt.query_row([&task_id, &date], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    
    Ok(count > 0)
}

#[tauri::command]
fn get_time_entries(occurrence_id: String, state: State<DbState>) -> Result<Vec<TimeEntry>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, occurrence_id, task_id, date, start_time, end_time, duration FROM time_entries WHERE occurrence_id = ?1 ORDER BY start_time ASC")
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map([&occurrence_id], |row| {
            Ok(TimeEntry {
                id: row.get(0)?,
                occurrence_id: row.get(1)?,
                task_id: row.get(2)?,
                date: row.get(3)?,
                start_time: row.get(4)?,
                end_time: row.get(5)?,
                duration: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<TimeEntry>>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
fn create_time_entry(entry: TimeEntry, state: State<DbState>) -> Result<TimeEntry, String> {
    let conn = state.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO time_entries (id, occurrence_id, task_id, date, start_time, end_time, duration) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (
            &entry.id,
            &entry.occurrence_id,
            &entry.task_id,
            &entry.date,
            &entry.start_time,
            &entry.end_time,
            &entry.duration,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(entry)
}

#[tauri::command]
fn get_setting(key: String, state: State<DbState>) -> Result<Option<String>, String> {
    let conn = state.conn.lock().unwrap();
    let result: SqliteResult<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [&key],
        |row| row.get(0),
    );

    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn set_setting(key: String, value: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_database_path(state: State<DbState>) -> Result<String, String> {
    Ok(state.db_path.clone())
}

fn main() {
    // Get app data directory - using the same path as your working version
    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .expect("Failed to get app data directory");
    
    std::fs::create_dir_all(&app_dir).expect("Failed to create app directory");
    
    let db_path = app_dir.join("task_grid.db");
    let db_path_string = db_path.to_string_lossy().to_string();
    
    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_database(&conn).expect("Failed to initialize database");

    let db_state = DbState {
        conn: Mutex::new(conn),
        db_path: db_path_string,
    };

    tauri::Builder::default()
        .setup(|app| {
            app.manage(db_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            create_task,
            update_task,
            delete_task,
            get_occurrences,
            create_occurrence,
            update_occurrence,
            delete_occurrence,
            get_occurrences_by_repeat_group,
            update_future_repeat_entries,
            delete_future_repeat_entries,
            check_occurrence_exists,
            get_time_entries,
            create_time_entry,
            get_setting,
            set_setting,
            get_database_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
