param([string]$JdkHome = $env:JAVA_HOME)
$ErrorActionPreference = 'Stop'
if (-not $JdkHome -or -not (Test-Path (Join-Path $JdkHome 'bin/java.exe'))) { throw 'Set JAVA_HOME to a JDK 21 installation or pass -JdkHome.' }
$env:JAVA_HOME = $JdkHome
$env:Path = (Join-Path $JdkHome 'bin') + ';' + $env:Path
Push-Location (Join-Path $PSScriptRoot '..')
try {
 npm.cmd run build:feedback
 if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
 npx.cmd cap sync android
 if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
 Push-Location android
 try { & .\gradlew.bat :app:assembleDebug -PdariFeedback=true --console=plain; if ($LASTEXITCODE -ne 0) { throw 'APK build failed' } }
 finally { Pop-Location }
 Write-Host 'APK: android/app/build/outputs/apk/debug/app-debug.apk'
} finally { Pop-Location }
