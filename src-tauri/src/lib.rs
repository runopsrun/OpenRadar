use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

const SETTINGS_FILE: &str = "settings.json";
const MAX_SETTINGS_BYTES: usize = 2 * 1024 * 1024;
const MAX_EXPORT_BYTES: usize = 64 * 1024 * 1024;

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(SETTINGS_FILE))
        .map_err(|error| format!("Could not resolve the settings directory: {error}"))
}

#[cfg(unix)]
fn restrict_permissions(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &Path) -> std::io::Result<()> {
    Ok(())
}

/// Write through a temporary file so an interrupted write cannot corrupt the
/// user's saved preferences.
fn write_atomic(path: &Path, contents: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create the settings directory: {error}"))?;
    }

    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents)
        .map_err(|error| format!("Could not write the temporary settings file: {error}"))?;
    restrict_permissions(&temporary)
        .map_err(|error| format!("Could not restrict settings permissions: {error}"))?;

    #[cfg(windows)]
    if path.exists() {
        // std::fs::rename cannot replace an existing file on Windows.
        let _ = fs::remove_file(path);
    }

    fs::rename(&temporary, path)
        .map_err(|error| format!("Could not replace the settings file: {error}"))
}

/// Read persisted settings for the webview. Returns `None` on first launch.
#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read settings: {error}")),
    }
}

/// Persist the Zustand settings blob. The frontend already debounces writes.
#[tauri::command]
fn save_settings(app: AppHandle, contents: String) -> Result<(), String> {
    if contents.len() > MAX_SETTINGS_BYTES {
        return Err("The settings payload is unexpectedly large.".into());
    }
    serde_json::from_str::<serde_json::Value>(&contents)
        .map_err(|error| format!("Refusing to save invalid settings JSON: {error}"))?;

    let path = settings_path(&app)?;
    write_atomic(&path, contents.as_bytes())
}

fn sanitized_file_name(raw: &str) -> String {
    let base = raw
        .rsplit(|character| character == '/' || character == '\\')
        .next()
        .unwrap_or_default();

    let mut cleaned: String = base
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
        .take(96)
        .collect();

    if cleaned.is_empty() || cleaned == "." || cleaned == ".." {
        cleaned = "openradar".into();
    }
    if !cleaned.to_ascii_lowercase().ends_with(".png") {
        cleaned.push_str(".png");
    }
    cleaned
}

fn export_directory(app: &AppHandle) -> PathBuf {
    let pictures = app.path().picture_dir().or_else(|_| app.path().download_dir());
    let fallback = app.path().home_dir();
    pictures
        .or(fallback)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("OpenRadar")
}

/// Save a PNG exported from the map canvas and return the absolute path.
#[tauri::command]
fn save_export(app: AppHandle, data_url: String, file_name: String) -> Result<String, String> {
    let encoded = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| "The export payload is not a PNG data URL.".to_string())?;

    if encoded.len() > MAX_EXPORT_BYTES {
        return Err("The map image is too large to save.".into());
    }

    let bytes = STANDARD
        .decode(encoded)
        .map_err(|error| format!("Could not decode the PNG export: {error}"))?;

    if bytes.len() < 8 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" {
        return Err("The export payload is not a valid PNG image.".into());
    }

    let directory = export_directory(&app);
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create the export directory: {error}"))?;

    let path = directory.join(sanitized_file_name(&file_name));
    fs::write(&path, bytes).map_err(|error| format!("Could not write the PNG export: {error}"))?;

    Ok(path.display().to_string())
}

fn reveal_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show OpenRadar", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", "Refresh radar data", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &refresh, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("openradar-tray")
        .tooltip("OpenRadar — weather radar")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => reveal_main_window(app),
            "refresh" => {
                let _ = app.emit("openradar:refresh", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                reveal_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            save_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenRadar");
}
