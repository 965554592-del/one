# Extract all images from 镜片目录.xls grouped by source row.
# For each row with N images, save them as row<N>_<i>.png in extracted-images/.
# Also write a metadata JSON with: { row -> { oem, name, images: [paths] } }

$ErrorActionPreference = 'Stop'
$xlsPath = Join-Path $PSScriptRoot '..\jingpian_catalog.xls' | Resolve-Path | Select-Object -ExpandProperty Path
$outDir = Join-Path $PSScriptRoot '..\extracted-images'
if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
New-Item -ItemType Directory -Path $outDir | Out-Null

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$metaList = @()

try {
    $wb = $excel.Workbooks.Open($xlsPath, $null, $true)
    $ws = $wb.Worksheets.Item(1)

    # Group shapes by anchor row, then by horizontal position (left -> front, right -> back).
    # Build a row-position map (cumulative row Tops) for shapes whose TopLeftCell.Row
    # access throws (happens with certain grouped/legacy anchors in .xls files).
    $rowTops = @{}
    $maxRow = $ws.UsedRange.Rows.Count
    for ($r = 1; $r -le $maxRow; $r++) {
        $rowTops[$r] = [double]$ws.Cells.Item($r, 1).Top
    }
    function Resolve-RowFromTop($top, $rowTops, $maxRow) {
        # Find the largest row whose Top is <= shape Top
        $bestRow = 1
        for ($r = 1; $r -le $maxRow; $r++) {
            if ($rowTops[$r] -le ($top + 0.5)) { $bestRow = $r } else { break }
        }
        return $bestRow
    }

    $byRow = @{}
    $unanchored = 0
    foreach ($shape in $ws.Shapes) {
        $row = $null
        try { $row = $shape.TopLeftCell.Row } catch { }
        if (-not $row) {
            try {
                $top = [double]$shape.Top
                $row = Resolve-RowFromTop $top $rowTops $maxRow
                $unanchored++
            } catch { continue }
        }
        $left = 0
        try { $left = [double]$shape.Left } catch { }
        $entry = [PSCustomObject]@{ Shape = $shape; Left = $left }
        if (-not $byRow.ContainsKey($row)) { $byRow[$row] = New-Object System.Collections.ArrayList }
        [void]$byRow[$row].Add($entry)
    }
    Write-Host "Shapes resolved via Top fallback: $unanchored"

    foreach ($rowNum in ($byRow.Keys | Sort-Object)) {
        $items = @($byRow[$rowNum] | Sort-Object -Property Left)
        $name = [string]$ws.Cells.Item($rowNum, 2).Value2
        $oem  = [string]$ws.Cells.Item($rowNum, 3).Value2
        $year = [string]$ws.Cells.Item($rowNum, 4).Value2

        $imgPaths = @()
        for ($i = 0; $i -lt $items.Count; $i++) {
            $shape = $items[$i].Shape
            $filename = "row{0:D3}_{1}.png" -f $rowNum, ($i + 1)
            $outPath = Join-Path $outDir $filename

            # Copy shape as picture, then paste into a chart and export
            $shape.CopyPicture(1, 2) | Out-Null

            $w = [double]$shape.Width
            $h = [double]$shape.Height
            if ($w -lt 10) { $w = 200 }
            if ($h -lt 10) { $h = 150 }
            $chart = $ws.ChartObjects().Add(0, 0, $w, $h)
            $chartObj = $chart.Chart
            $chartObj.Paste()
            $chartObj.Export($outPath, "PNG") | Out-Null
            $chart.Delete()

            $imgPaths += "extracted-images/$filename"
        }

        $metaList += @{
            row = $rowNum
            name = $name
            oem = $oem
            year = $year
            images = $imgPaths
        }

        if ($rowNum % 20 -eq 0) { Write-Host "Processed row $rowNum" }
    }

    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}

$metaPath = Join-Path $PSScriptRoot '..\extracted-images-meta.json'
$metaList | ConvertTo-Json -Depth 5 | Out-File -FilePath $metaPath -Encoding utf8
Write-Host "Done. Extracted images: $((Get-ChildItem $outDir).Count). Meta: $metaPath"
