#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
pub fn ensure_webview2() -> bool {
    true
}

#[cfg(target_os = "windows")]
pub fn ensure_webview2() -> bool {
    if webview2_installed() {
        return true;
    }

    let message: Vec<u16> = "未检测到 Microsoft Edge WebView2 运行时。\n\n请先安装 WebView2 Runtime，然后重新启动 YUV Image Viewer。\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let caption: Vec<u16> = "YUV Image Viewer"
        .encode_utf16()
        .chain(Some(0))
        .collect();

    unsafe {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            MessageBoxW, MB_ICONERROR, MB_OK,
        };
        MessageBoxW(0, message.as_ptr(), caption.as_ptr(), MB_OK | MB_ICONERROR);
    }
    false
}

#[cfg(target_os = "windows")]
fn webview2_installed() -> bool {
    use windows_sys::Win32::System::Registry::{
        RegGetValueW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ,
    };

    const CLIENT_GUID: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

    fn has_version(hkey: HKEY, subkey: &str) -> bool {
        let subkey: Vec<u16> = subkey.encode_utf16().chain(Some(0)).collect();
        let name: Vec<u16> = "pv".encode_utf16().chain(Some(0)).collect();
        let mut size: u32 = 0;
        let status = unsafe {
            RegGetValueW(
                hkey,
                subkey.as_ptr(),
                name.as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut size,
            )
        };
        status == 0 && size > 2
    }

    let machine = format!("SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{CLIENT_GUID}");
    let user = format!("SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{CLIENT_GUID}");

    has_version(HKEY_LOCAL_MACHINE, &machine) || has_version(HKEY_CURRENT_USER, &user)
}
