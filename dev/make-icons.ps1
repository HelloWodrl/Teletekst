# Crta ikone aplikacije (crni ekran, plava traka, četiri obojene tipke) u public/icons.
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Force $dir | Out-Null

function Draw([int]$size, [string]$name, [double]$inset) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'None'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Black)
  $m = [int]($size * $inset)
  $w = $size - 2 * $m
  $u = $w / 10.0

  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 0, 255))), $m, [int]($m + 1.2 * $u), $w, [int](2.2 * $u))
  $font = New-Object System.Drawing.Font 'Consolas', ([float](1.55 * $u)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $g.DrawString('P100', $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 0))),
    ([System.Drawing.RectangleF]::new($m, $m + 1.2 * $u, $w, 2.2 * $u)), $fmt)

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 255, 255))
  foreach ($i in 0..2) {
    $y = [int]($m + (4.2 + 1.2 * $i) * $u)
    $g.FillRectangle($(if ($i % 2) { $white } else { $cyan }), [int]($m + 0.8 * $u), $y, [int]((6.4 - 1.4 * $i) * $u), [int](0.6 * $u))
  }

  $cols = @(@(255, 0, 0), @(0, 255, 0), @(255, 255, 0), @(0, 255, 255))
  foreach ($i in 0..3) {
    $c = $cols[$i]
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($c[0], $c[1], $c[2]))),
      [int]($m + $i * 2.5 * $u), [int]($m + 8.0 * $u), [int](2.5 * $u), [int](1.2 * $u))
  }
  $g.Dispose()
  $bmp.Save((Join-Path $dir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "napravljeno $name"
}

Draw 192 'icon-192.png' 0.06
Draw 512 'icon-512.png' 0.06
Draw 512 'maskable-512.png' 0.16
