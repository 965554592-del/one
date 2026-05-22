$null = [Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
$zip = [IO.Compression.ZipFile]::OpenRead('c:\Users\ASUS\Desktop\Vida_Auto_Catalog.xlsx')
$zip.Entries | Select-Object FullName, Length | Sort-Object FullName | Format-Table -AutoSize
$zip.Dispose()
