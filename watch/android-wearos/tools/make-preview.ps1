# Generates the watch face preview (480x480, the Galaxy Watch 7 44mm panel) and a small
# app/complication icon for BOTH modules (app/ and wff/ carry identical copies).
# Look is not the point; the picker just needs a drawable.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\make-preview.ps1
Add-Type -AssemblyName System.Drawing

$outDirs = @(
  (Join-Path $PSScriptRoot '..\app\src\main\res\drawable-nodpi'),
  (Join-Path $PSScriptRoot '..\wff\src\main\res\drawable-nodpi')
)
foreach ($d in $outDirs) { New-Item -ItemType Directory -Force $d | Out-Null }

function Col($a, $r, $g, $b) { [System.Drawing.Color]::FromArgb($a, $r, $g, $b) }

function Draw-Face([int]$size, [string]$path, [bool]$withText) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAlias'
  $g.Clear((Col 255 7 9 15))

  $cx = $size / 2.0; $cy = $size / 2.0; $r = $cx * 0.8
  $amber = Col 255 245 158 11

  # outer ring
  $pen = New-Object System.Drawing.Pen ((Col 140 245 158 11), [float]($size / 320))
  $rr = $r + $r * 0.125
  $g.DrawEllipse($pen, [float]($cx - $rr), [float]($cy - $rr), [float](2 * $rr), [float](2 * $rr))

  # 96 ticks
  for ($i = 0; $i -lt 96; $i++) {
    $angle = ($i / 96.0) * 360.0 - 90.0
    $rad = $angle * [Math]::PI / 180.0
    $major = ($i % 4) -eq 0
    $inner = if ($major) { $r - $r * 0.06 } else { $r + $r * 0.01 }
    $outer = $r + $r * 0.06
    $tp = New-Object System.Drawing.Pen ($(if ($major) { Col 230 245 158 11 } else { Col 180 61 79 102 }), [float]($(if ($major) { $size / 260 } else { $size / 700 })))
    $g.DrawLine($tp, [float]($cx + $inner * [Math]::Cos($rad)), [float]($cy + $inner * [Math]::Sin($rad)), [float]($cx + $outer * [Math]::Cos($rad)), [float]($cy + $outer * [Math]::Sin($rad)))
  }

  # sample event arcs (start minute, duration, colour)
  $arcR = $r - $r * 0.2
  $events = @(
    @(540, 60,  (Col 178 56 189 248)),
    @(660, 45,  (Col 178 52 211 153)),
    @(780, 90,  (Col 178 251 191 36)),
    @(1020, 60, (Col 178 167 139 250))
  )
  foreach ($e in $events) {
    $ap = New-Object System.Drawing.Pen ($e[2], [float]($size / 100))
    $g.DrawArc($ap, [float]($cx - $arcR), [float]($cy - $arcR), [float](2 * $arcR), [float](2 * $arcR), [float](($e[0] / 1440.0) * 360.0 - 90.0), [float](($e[1] / 1440.0) * 360.0))
  }

  # progress sweep to 10:08
  $cur = 608
  $sp = New-Object System.Drawing.Pen ((Col 230 245 158 11), [float]($size / 170))
  $sp.StartCap = 'Round'; $sp.EndCap = 'Round'
  $arcR2 = $r - $r * 0.1
  $g.DrawArc($sp, [float]($cx - $arcR2), [float]($cy - $arcR2), [float](2 * $arcR2), [float](2 * $arcR2), -90.0, [float](($cur / 1440.0) * 360.0))

  # centre dial
  $dialR = $r * 0.41
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (Col 255 7 9 15)), [float]($cx - $dialR), [float]($cy - $dialR), [float](2 * $dialR), [float](2 * $dialR))
  $g.DrawEllipse((New-Object System.Drawing.Pen ((Col 255 31 45 66), 1)), [float]($cx - $dialR), [float]($cy - $dialR), [float](2 * $dialR), [float](2 * $dialR))

  if ($withText) {
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $px = [System.Drawing.GraphicsUnit]::Pixel
    $f1 = New-Object System.Drawing.Font ('Consolas', [float]($r * 0.16), [System.Drawing.FontStyle]::Bold, $px)
    $g.DrawString("$cur", $f1, (New-Object System.Drawing.SolidBrush $amber), [float]$cx, [float]($cy - $r * 0.12), $fmt)
    $f2 = New-Object System.Drawing.Font ('Consolas', [float]($r * 0.065), [System.Drawing.FontStyle]::Regular, $px)
    $g.DrawString('MIN ELAPSED', $f2, (New-Object System.Drawing.SolidBrush (Col 255 100 116 139)), [float]$cx, [float]($cy + $r * 0.03), $fmt)
    $f3 = New-Object System.Drawing.Font ('Consolas', [float]($r * 0.09), [System.Drawing.FontStyle]::Regular, $px)
    $g.DrawString('10:08 AM', $f3, (New-Object System.Drawing.SolidBrush (Col 255 148 163 184)), [float]$cx, [float]($cy + $r * 0.17), $fmt)
  }

  # minute hand
  $ha = ($cur / 1440.0) * 360.0 - 90.0
  $hr = $ha * [Math]::PI / 180.0
  $hl = $r * 0.62
  $hp = New-Object System.Drawing.Pen ($amber, [float]($size / 220))
  $hp.StartCap = 'Round'; $hp.EndCap = 'Round'
  $g.DrawLine($hp, [float]$cx, [float]$cy, [float]($cx + $hl * [Math]::Cos($hr)), [float]($cy + $hl * [Math]::Sin($hr)))
  $dot = $size / 137.0
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $amber), [float]($cx - $dot), [float]($cy - $dot), [float](2 * $dot), [float](2 * $dot))

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "wrote $path"
}

foreach ($d in $outDirs) {
  Draw-Face 480 ([System.IO.Path]::GetFullPath((Join-Path $d 'watch_face_preview.png'))) $true
  Draw-Face 96  ([System.IO.Path]::GetFullPath((Join-Path $d 'ic_1440.png'))) $false
}
