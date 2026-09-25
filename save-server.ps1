$ErrorActionPreference = "Stop"
$Port = 8734
if ($env:PORT) { $Port = [int]$env:PORT }
$SavePath = "G:\Installed Software\1 Temp\1 Temp\Cool Room Consumption Folder\Nylene consumption sheet.xlsx"
if ($env:EXCEL_SAVE_PATH) { $SavePath = $env:EXCEL_SAVE_PATH }
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootFull = [System.IO.Path]::GetFullPath($Root)
$MaxBytes = 20MB

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Inspection sheet: http://127.0.0.1:$Port/"
Write-Host "Excel file: $SavePath"
Start-Process "http://127.0.0.1:$Port/"

function Send-Bytes($response, $status, $bytes, $contentType) {
  $response.StatusCode = $status
  $response.ContentType = $contentType
  $response.Headers["Access-Control-Allow-Origin"] = "*"
  $response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
  $response.Headers["Access-Control-Allow-Headers"] = "Content-Type"
  $response.Headers["Access-Control-Allow-Private-Network"] = "true"
  $response.Headers["Cache-Control"] = "no-cache"
  $response.ContentLength64 = $bytes.Length
  if ($bytes.Length -gt 0) {
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  $response.OutputStream.Close()
}

function Send-Text($response, $status, $text, $contentType) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  Send-Bytes $response $status $bytes $contentType
}

function Send-Json($response, $status, $data) {
  Send-Text $response $status ($data | ConvertTo-Json -Compress) "application/json; charset=utf-8"
}

function Get-ContentType($file) {
  switch ([System.IO.Path]::GetExtension($file).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".js" { return "text/javascript; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".svg" { return "image/svg+xml" }
    ".png" { return "image/png" }
    ".ico" { return "image/x-icon" }
    ".json" { return "application/json; charset=utf-8" }
    default { return "application/octet-stream" }
  }
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    try {
      $pathOnly = $request.Url.AbsolutePath
      if ($request.HttpMethod -eq "OPTIONS") {
        Send-Bytes $response 204 ([byte[]]@()) "text/plain"
        continue
      }
      if (($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD") -and $pathOnly -eq "/api/save-excel") {
        Send-Json $response 200 @{ ok = $true; path = $SavePath }
        continue
      }
      if ($request.HttpMethod -eq "POST" -and $pathOnly -eq "/api/save-excel") {
        $stream = New-Object System.IO.MemoryStream
        $request.InputStream.CopyTo($stream)
        $buffer = $stream.ToArray()
        if ($buffer.Length -eq 0) {
          Send-Json $response 400 @{ ok = $false; error = "Could not save an empty workbook." }
          continue
        }
        if ($buffer.Length -gt $MaxBytes) {
          Send-Json $response 413 @{ ok = $false; error = "That workbook is too large to save." }
          continue
        }
        $temp = "$SavePath.saving"
        try {
          $dir = Split-Path -Parent $SavePath
          [System.IO.Directory]::CreateDirectory($dir) | Out-Null
          [System.IO.File]::WriteAllBytes($temp, $buffer)
          [System.IO.File]::Copy($temp, $SavePath, $true)
          Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
          Send-Json $response 200 @{ ok = $true; path = $SavePath }
        } catch {
          Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
          $detail = $_.Exception.Message
          if (-not $detail -and $_.Exception.InnerException) { $detail = $_.Exception.InnerException.Message }
          if ($detail -match "being used by another process" -or $detail -match "used by another") {
            Send-Json $response 423 @{ ok = $false; error = "Excel has that workbook open. Close Nylene consumption sheet.xlsx, then save again." }
          } else {
            Send-Json $response 500 @{ ok = $false; error = "Could not save to ${SavePath}. $detail" }
          }
        }
        continue
      }
      if ($request.HttpMethod -ne "GET" -and $request.HttpMethod -ne "HEAD") {
        Send-Json $response 405 @{ ok = $false; error = "That request is not supported." }
        continue
      }
      $rel = [System.Uri]::UnescapeDataString($pathOnly.TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
      $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
      if ($full -ne $RootFull -and -not $full.StartsWith($RootFull + [System.IO.Path]::DirectorySeparatorChar)) {
        Send-Text $response 403 "Forbidden" "text/plain; charset=utf-8"
        continue
      }
      if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Send-Text $response 404 "Not found" "text/plain; charset=utf-8"
        continue
      }
      $fileBytes = [System.IO.File]::ReadAllBytes($full)
      if ($request.HttpMethod -eq "HEAD") {
        Send-Bytes $response 200 ([byte[]]@()) (Get-ContentType $full)
      } else {
        Send-Bytes $response 200 $fileBytes (Get-ContentType $full)
      }
    } catch {
      try {
        $detail = $_.Exception.Message
        Send-Json $response 500 @{ ok = $false; error = "Could not save to ${SavePath}. $detail" }
      } catch { }
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
