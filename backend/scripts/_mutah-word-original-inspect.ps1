$ErrorActionPreference = 'Stop'
$src = Get-ChildItem -LiteralPath 'D:\LMS\backend\assets\field-training' -Filter '*.docx' | Select-Object -First 1
Copy-Item -LiteralPath $src.FullName -Destination 'D:\LMS\backend\tmp\mutah-original.docx' -Force
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open('D:\LMS\backend\tmp\mutah-original.docx', $false, $true)
  $pages = $doc.ComputeStatistics(2)
  $tableInfo = @()
  foreach ($table in $doc.Tables) {
    if ($table.Columns.Count -lt 7) { continue }
    $header = @()
    for ($c = 1; $c -le 7; $c++) {
      $raw = $table.Cell(1, $c).Range.Text
      $header += (($raw -replace '[^\p{L}\p{N} ]', ' ').Trim())
    }
    $tableInfo += [pscustomobject]@{
      columns = $table.Columns.Count
      rows = $table.Rows.Count
      tableDirection = [int]$table.TableDirection
      headerCells = $header
    }
  }
  [pscustomobject]@{
    file = 'original'
    pages = $pages
    inlineShapes = $doc.InlineShapes.Count
    shapes = $doc.Shapes.Count
    tables = $tableInfo
  } | ConvertTo-Json -Depth 6
  $doc.Close($false)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
