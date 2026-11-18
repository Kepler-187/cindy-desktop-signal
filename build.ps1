$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
Push-Location $PSScriptRoot
try {
    & "$framework/csc.exe" /nologo /target:winexe /out:plugin/node/Signal.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "/r:$framework/WPF/PresentationCore.dll" "/r:$framework/WPF/PresentationFramework.dll" "/r:$framework/WPF/WindowsBase.dll" /r:System.Xaml.dll Signal.cs
    if ($LASTEXITCODE -ne 0) { throw 'Desktop component compilation failed.' }
} finally { Pop-Location }
