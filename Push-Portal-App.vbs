Option Explicit
Dim fso, root, parent, srcPortal, dstDeploy, dstWebsite, deployDir
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
parent = fso.GetParentFolderName(root)
srcPortal = fso.BuildPath(root, "app.html")
deployDir = fso.BuildPath(root, "netlify-deploy")
dstDeploy = fso.BuildPath(deployDir, "app.html")
dstWebsite = fso.BuildPath(parent, "Posture Clinic Website\app.html")
If Not fso.FileExists(srcPortal) Then
  WScript.Echo "Source not found: " & srcPortal
  WScript.Quit 1
End If
If Not fso.FolderExists(deployDir) Then fso.CreateFolder deployDir
fso.CopyFile srcPortal, dstDeploy, True
If fso.FolderExists(fso.GetParentFolderName(dstWebsite)) Then
  fso.CopyFile srcPortal, dstWebsite, True
End If
WScript.Echo "Pushed Portal app.html to netlify-deploy and Website."
WScript.Echo dstDeploy & " (" & fso.GetFile(dstDeploy).Size & " bytes)"
