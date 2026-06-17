# Generates build/icon.png (1024) and a multi-size build/icon.ico using GDI+.
Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $s = [float]$size
  # background rounded square with blurple gradient
  $bgPath = New-RoundedPath 0 0 $s $s ($s * 0.22)
  $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s)
  $c1 = [System.Drawing.Color]::FromArgb(255, 88, 101, 242)   # #5865F2
  $c2 = [System.Drawing.Color]::FromArgb(255, 60, 66, 170)    # deeper blurple
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 55)
  $g.FillPath($grad, $bgPath)

  # robot head (white rounded rect)
  $hw = $s * 0.52; $hh = $s * 0.42
  $hx = ($s - $hw) / 2; $hy = $s * 0.34
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $headPath = New-RoundedPath $hx $hy $hw $hh ($s * 0.12)
  $g.FillPath($white, $headPath)

  # antenna
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]($s * 0.035))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, [float]($s / 2), [float]($s * 0.34), [float]($s / 2), [float]($s * 0.22))
  $g.FillEllipse($white, [float]($s / 2 - $s * 0.045), [float]($s * 0.17), [float]($s * 0.09), [float]($s * 0.09))

  # eyes (blurple)
  $eye = New-Object System.Drawing.SolidBrush($c1)
  $eyeR = $s * 0.075
  $eyeY = $hy + $hh * 0.42
  $g.FillEllipse($eye, [float]($hx + $hw * 0.26 - $eyeR), [float]$eyeY, [float]($eyeR * 2), [float]($eyeR * 2))
  $g.FillEllipse($eye, [float]($hx + $hw * 0.74 - $eyeR), [float]$eyeY, [float]($eyeR * 2), [float]($eyeR * 2))

  $g.Dispose()
  return $bmp
}

$buildDir = Join-Path $PSScriptRoot "..\build"
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

# 1024 PNG
$big = New-IconBitmap 1024
$pngPath = Join-Path $buildDir "icon.png"
$big.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$big.Dispose()
Write-Host "Wrote $pngPath"

# Multi-size ICO (PNG-compressed entries)
$sizes = 16, 24, 32, 48, 64, 128, 256
$pngBytes = @()
foreach ($sz in $sizes) {
  $bm = New-IconBitmap $sz
  $ms = New-Object System.IO.MemoryStream
  $bm.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes += , ($ms.ToArray())
  $ms.Dispose(); $bm.Dispose()
}
$icoPath = Join-Path $buildDir "icon.ico"
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $sz = $sizes[$i]; $data = $pngBytes[$i]
  $bw.Write([byte]($(if ($sz -ge 256) { 0 } else { $sz })))
  $bw.Write([byte]($(if ($sz -ge 256) { 0 } else { $sz })))
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$data.Length); $bw.Write([uint32]$offset)
  $offset += $data.Length
}
foreach ($data in $pngBytes) { $bw.Write($data) }
$bw.Flush(); $bw.Close(); $fs.Close()
Write-Host "Wrote $icoPath"
