$ErrorActionPreference = 'Stop'
$dir = 'D:\LMS\backend\tmp\mutah-word-qa'
$files = Get-ChildItem -LiteralPath $dir -Filter '*.docx'
if (-not $files) { throw 'No sample DOCX' }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$results = @()
try {
  foreach ($docx in $files) {
    $doc = $word.Documents.Open($docx.FullName, $false, $true)
    $pages = $doc.ComputeStatistics(2)
    $tableInfo = @()
    foreach ($table in $doc.Tables) {
      if ($table.Columns.Count -lt 7) { continue }
      $header = @()
      for ($c = 1; $c -le [Math]::Min(7, $table.Columns.Count); $c++) {
        $raw = $table.Cell(1, $c).Range.Text
        $header += (($raw -replace '[^\p{L}\p{N} ]', ' ').Trim())
      }
      $tableInfo += [pscustomobject]@{
        columns = $table.Columns.Count
        rows = $table.Rows.Count
        tableDirection = [int]$table.TableDirection
        headerLeftToRight = $header
      }
    }
    $results += [pscustomobject]@{
      file = $docx.Name
      pages = $pages
      inlineShapes = $doc.InlineShapes.Count
      shapes = $doc.Shapes.Count
      tables = $tableInfo
    }
    $doc.Close($false)
  }
  $results | ConvertTo-Json -Depth 8
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
