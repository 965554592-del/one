$ErrorActionPreference = 'Stop'
$xlsPath = Join-Path $PSScriptRoot '..\jingpian_catalog.xls' | Resolve-Path | Select-Object -ExpandProperty Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $wb = $excel.Workbooks.Open($xlsPath, $null, $true)
    $ws = $wb.Worksheets.Item(1)
    Write-Host "Row 4 top: $($ws.Cells.Item(4,1).Top), height: $($ws.Rows.Item(4).Height)"
    Write-Host "Row 5 top: $($ws.Cells.Item(5,1).Top), height: $($ws.Rows.Item(5).Height)"
    Write-Host "Row 6 top: $($ws.Cells.Item(6,1).Top), height: $($ws.Rows.Item(6).Height)"
    Write-Host "Row 4 B: '$($ws.Cells.Item(4,2).Value2)'"
    Write-Host "Row 5 B: '$($ws.Cells.Item(5,2).Value2)'"
    Write-Host "Row 6 B: '$($ws.Cells.Item(6,2).Value2)'"
    Write-Host "`nAll shapes anchored to rows 3-7:"
    foreach ($shape in $ws.Shapes) {
        $r = $null; try { $r = $shape.TopLeftCell.Row } catch {}
        if ($r -ge 3 -and $r -le 7) {
            Write-Host "  Shape '$($shape.Name)' row=$r top=$($shape.Top) left=$($shape.Left) w=$($shape.Width) h=$($shape.Height)"
        }
    }
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
