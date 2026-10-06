#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Auto-encendido del motor backend (server.js) localmente
      std::thread::spawn(|| {
        let mut cmd = std::process::Command::new("node");
        cmd.arg("server.js");
        
        #[cfg(target_os = "windows")]
        {
          use std::os::windows::process::CommandExt;
          // CREATE_NO_WINDOW = 0x08000000 para que corra en segundo plano invisible
          cmd.creation_flags(0x08000000);
        }

        let _ = cmd.spawn();
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
