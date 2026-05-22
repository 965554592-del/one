# Inspect images in 镜片目录.xls via Excel COM
$ErrorActionPreference = 'Stop'
$xlsPath = Join-Path $PSScriptRoot '..\jingpian_catalog.xls' | Resolve-Path | Select-Object -ExpandProperty Path

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($xlsPath, $null, $true) # ReadOnly
    foreach ($ws in $wb.Worksheets) {
        Write-Host "=== Sheet: $($ws.Name) ==="
        Write-Host "UsedRange rows: $($ws.UsedRange.Rows.Count), cols: $($ws.UsedRange.Columns.Count)"
        Write-Host "Shapes count: $($ws.Shapes.Count)"

        # Map shape -> anchor row to determine images per row
        $rowMap = @{}
        foreach ($shape in $ws.Shapes) {
            try {
                $row = $shape.TopLeftCell.Row
                if (-not $rowMap.ContainsKey($row)) { $rowMap[$row] = 0 }
                $rowMap[$row]++
            } catch { }
        }

        # Print distribution
        $oneImg = 0; $twoImg = 0; $moreImg = 0
        foreach ($k in $rowMap.Keys) {
            $c = $rowMap[$k]
            if ($c -eq 1) { $oneImg++ }
            elseif ($c -eq 2) { $twoImg++ }
            else { $moreImg++ }
        }
        Write-Host "Rows with 1 image: $oneImg, Rows with 2 images: $twoImg, Rows with more: $moreImg"

        # Show first 10 rows with their image counts
        $sorted = $rowMap.Keys | Sort-Object
        $i = 0
        foreach ($k in $sorted) {
            if ($i -ge 15) { break }
            $name = $ws.Cells.Item($k, 2).Value2
            Write-Host "  Row $k : $($rowMap[$k]) image(s) - $name"
            $i++
        }
    }
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
