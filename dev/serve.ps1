# Jednostavan lokalni web poslužitelj za testiranje (nema potrebe za Node.js-om).
# Pokretanje:  powershell -ExecutionPolicy Bypass -File dev\serve.ps1
# Aplikacija:  http://localhost:8080/public/
# Testna obrada vijesti: http://localhost:8080/dev/harness.html (sprema public/data/news.json)
param([int]$Port = 8080)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'
  '.xml' = 'application/xml; charset=utf-8'; '.svg' = 'image/svg+xml'; '.txt' = 'text/plain; charset=utf-8'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Poslužitelj radi: http://localhost:$Port/public/"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq '/') { $res.Redirect('/public/'); $res.Close(); continue }
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
    if (-not $file.StartsWith($root)) { $res.StatusCode = 403; $res.Close(); continue }

    if ($req.HttpMethod -eq 'PUT' -and $path -eq '/public/data/news.json') {
      New-Item -ItemType Directory -Force (Split-Path $file) | Out-Null
      $ms = New-Object IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      [IO.File]::WriteAllBytes($file, $ms.ToArray())
      $res.StatusCode = 204
    } elseif (Test-Path $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' })
      $res.Headers['Cache-Control'] = 'no-cache'
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    Write-Host "$($req.HttpMethod) $path $($res.StatusCode)"
  } catch {
    $res.StatusCode = 500
    Write-Host "Greška: $_"
  }
  $res.Close()
}
