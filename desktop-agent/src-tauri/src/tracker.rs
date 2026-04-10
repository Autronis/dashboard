use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub app: String,
    pub title: String,
    pub url: Option<String>,
}

#[cfg(target_os = "windows")]
pub fn get_active_window() -> Option<WindowInfo> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::Foundation::CloseHandle;

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == windows::Win32::Foundation::HWND::default() {
            return None;
        }

        // Get window title
        let mut title_buf: [u16; 512] = [0; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        if title_len == 0 {
            return None;
        }
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

        // Get process ID
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }

        // Get process name
        let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut name_buf: [u16; 512] = [0; 512];
        let mut name_len: u32 = 512;
        let success = QueryFullProcessImageNameW(
            process_handle,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(name_buf.as_mut_ptr()),
            &mut name_len,
        );
        let _ = CloseHandle(process_handle);

        if success.is_err() {
            return None;
        }

        let full_path = String::from_utf16_lossy(&name_buf[..name_len as usize]);
        let app = full_path
            .rsplit('\\')
            .next()
            .unwrap_or(&full_path)
            .trim_end_matches(".exe")
            .to_string();

        // For UWP apps (ApplicationFrameHost), use the window title as app name
        let app = if app == "ApplicationFrameHost" {
            title.split(" - ").last().unwrap_or(&title).to_string()
        } else {
            app
        };

        // Try to get browser URL if this is a known browser
        let url = get_browser_url(&app, hwnd);

        Some(WindowInfo {
            app,
            title,
            url,
        })
    }
}

/// Extract URL from browser address bar using UI Automation API.
/// Works for Chrome, Edge, Firefox, Brave (Chromium-based browsers).
#[cfg(target_os = "windows")]
fn get_browser_url(app: &str, hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use windows::Win32::UI::Accessibility::*;

    let browser_apps = ["chrome", "msedge", "firefox", "brave", "vivaldi", "opera"];
    let app_lower = app.to_lowercase();
    if !browser_apps.iter().any(|b| app_lower.contains(b)) {
        return None;
    }

    unsafe {
        let automation: IUIAutomation = windows::Win32::System::Com::CoCreateInstance(
            &CUIAutomation,
            None,
            windows::Win32::System::Com::CLSCTX_INPROC_SERVER,
        ).ok()?;

        let element = automation.ElementFromHandle(hwnd).ok()?;

        // For Chromium browsers, the address bar has control type Edit
        // and is accessible via tree walking
        let condition = automation.CreatePropertyCondition(
            UIA_ControlTypePropertyId,
            &windows::core::VARIANT::from(UIA_EditControlTypeId.0 as i32),
        ).ok()?;

        let walker = automation.CreateTreeWalker(&condition).ok()?;

        // Search for the Edit control (address bar) — try first match
        fn find_edit(walker: &IUIAutomationTreeWalker, element: &IUIAutomationElement) -> Option<String> {
            unsafe {
                // Check current element
                if let Ok(val) = element.GetCurrentPropertyValue(UIA_ValueValuePropertyId) {
                    let s = val.to_string();
                    if s.contains("://") || s.contains(".") {
                        return Some(s);
                    }
                }
                // Check children
                if let Ok(child) = walker.GetFirstChildElement(element) {
                    if let Some(url) = find_edit(walker, &child) {
                        return Some(url);
                    }
                    let mut current = child;
                    while let Ok(next) = walker.GetNextSiblingElement(&current) {
                        if let Some(url) = find_edit(walker, &next) {
                            return Some(url);
                        }
                        current = next;
                    }
                }
                None
            }
        }

        find_edit(&walker, &element)
    }
}

#[cfg(target_os = "macos")]
pub fn get_active_window() -> Option<WindowInfo> {
    use std::process::Command;

    // Single osascript call that tries multiple methods to get window title
    // Method 1: System Events front window name (works for most apps)
    // Method 2: AXTitle attribute via System Events (works for Electron apps like VS Code)
    // Method 3: Direct app AppleScript (works for some apps)
    let output = Command::new("osascript")
        .args(["-e", r#"
tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set appName to name of frontApp
    set winTitle to ""

    -- Method 1: standard window name
    try
        set winTitle to name of front window of frontApp
    end try

    -- Method 2: AXTitle attribute (works better for Electron apps)
    if winTitle is "" then
        try
            set winTitle to value of attribute "AXTitle" of front window of frontApp
        end try
    end if

    -- Method 3: first window title attribute
    if winTitle is "" then
        try
            set winTitle to title of front window of frontApp
        end try
    end if

    return appName & "|||" & winTitle
end tell
"#])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parts: Vec<&str> = result.splitn(2, "|||").collect();

    let app = parts.first()?.trim().to_string();
    if app.is_empty() {
        return None;
    }

    let title = parts.get(1).map(|t| t.trim().to_string()).unwrap_or_default();

    // Fallback: for apps where System Events can't get window title,
    // try getting it via the app's own AppleScript interface
    let title = if title.is_empty() {
        get_app_title_fallback(&app).unwrap_or_default()
    } else {
        title
    };

    // Try to get browser URL
    let url = get_browser_url_macos(&app);

    Some(WindowInfo { app, title, url })
}

/// Fallback: get window title directly from the app (not via System Events)
#[cfg(target_os = "macos")]
fn get_app_title_fallback(app: &str) -> Option<String> {
    use std::process::Command;

    let script = format!(
        r#"try
    tell application "{}" to get name of front window
on error
    ""
end try"#,
        app
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .ok()?;

    if output.status.success() {
        let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !title.is_empty() && title != "missing value" {
            return Some(title);
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn get_browser_url_macos(app: &str) -> Option<String> {
    use std::process::Command;

    let app_lower = app.to_lowercase();

    let script = if app_lower.contains("safari") {
        r#"tell application "Safari" to get URL of front document"#.to_string()
    } else if app_lower.contains("chrome") || app_lower.contains("brave") || app_lower.contains("edge") || app_lower.contains("vivaldi") || app_lower.contains("opera") || app_lower.contains("arc") {
        // Chromium-based browsers all support the same AppleScript interface
        format!(r#"tell application "{}" to get URL of active tab of front window"#, app)
    } else if app_lower.contains("firefox") {
        // Firefox doesn't reliably support AppleScript for URLs
        return None;
    } else {
        return None;
    };

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .ok()?;

    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !url.is_empty() && url != "missing value" {
            return Some(url);
        }
    }
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_browser_url(_app: &str, _hwnd: ()) -> Option<String> {
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_active_window() -> Option<WindowInfo> {
    None
}

/// Check how long the user has been idle (no keyboard/mouse input)
#[cfg(target_os = "windows")]
pub fn get_idle_duration() -> std::time::Duration {
    use windows::Win32::System::SystemInformation::GetTickCount64;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    unsafe {
        let tick_count = GetTickCount64();
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        let _ = GetLastInputInfo(&mut info);
        let idle_ms = tick_count.wrapping_sub(info.dwTime as u64);
        std::time::Duration::from_millis(idle_ms)
    }
}

/// macOS idle duration via IOKit HIDIdleTime (nanoseconds)
#[cfg(target_os = "macos")]
pub fn get_idle_duration() -> std::time::Duration {
    use std::process::Command;

    let output = match Command::new("ioreg")
        .args(["-c", "IOHIDSystem", "-d", "4"])
        .output()
    {
        Ok(o) => o,
        Err(_) => return std::time::Duration::from_secs(0),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("HIDIdleTime") {
            // Line looks like: "HIDIdleTime" = 1234567890
            if let Some(val_str) = line.split('=').nth(1) {
                if let Ok(nanos) = val_str.trim().parse::<u64>() {
                    return std::time::Duration::from_nanos(nanos);
                }
            }
        }
    }
    std::time::Duration::from_secs(0)
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_idle_duration() -> std::time::Duration {
    std::time::Duration::from_secs(0)
}
