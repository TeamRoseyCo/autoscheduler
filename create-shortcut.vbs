Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get paths
desktopPath = WshShell.SpecialFolders("Desktop")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Create desktop shortcut for Electron app
Set shortcut = WshShell.CreateShortcut(desktopPath & "\AutoScheduler.lnk")
shortcut.TargetPath = appDir & "\dist-electron\win-unpacked\AutoScheduler.exe"
shortcut.WorkingDirectory = appDir
shortcut.IconLocation = appDir & "\public\icon.ico"
shortcut.Description = "AutoScheduler - AI Calendar"
shortcut.WindowStyle = 1
shortcut.Save

MsgBox "AutoScheduler shortcut created on your Desktop!", vbInformation, "AutoScheduler"
