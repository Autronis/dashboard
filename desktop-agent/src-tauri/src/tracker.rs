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

#[cfg(not(target_os = "windows"))]
fn get_browser_url(_app: &str, _hwnd: ()) -> Option<String> {
    None
}

#[cfg(not(target_os = "windows"))]
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

#[cfg(not(target_os = "windows"))]
pub fn get_idle_duration() -> std::time::Duration {
    std::time::Duration::from_secs(0)
}
