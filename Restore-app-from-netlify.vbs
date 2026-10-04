Option Explicit
Dim fso, root, src, dst, size
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
src = root & "\netlify-deploy\app.html"
dst = root & "\app.html"
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(src) Then
  MsgBox "Source not found:" & vbCrLf & src, vbCritical, "Restore app.html"
  WScript.Quit 1
End If
fso.CopyFile src, dst, True
size = fso.GetFile(dst).Size
MsgBox "Restored app.html" & vbCrLf & vbCrLf & dst & vbCrLf & vbCrLf & "Size: " & size & " bytes", vbInformation, "Restore app.html"
WScript.Quit 0
