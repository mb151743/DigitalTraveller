param(
  [Parameter(Mandatory = $true)][ValidateSet('Virsa', 'inLux', 'InVia')][string]$System,
  [Parameter(Mandatory = $true)][string]$WorkbookPath,
  [Parameter(Mandatory = $true)][AllowEmptyString()][string]$JobNumber,
  [Parameter(Mandatory = $true)][AllowEmptyString()][string]$CustomerName,
  [Parameter(Mandatory = $true)][AllowEmptyString()][string]$PartNumber,
  [Parameter(Mandatory = $true)][AllowEmptyString()][string]$SerialNumber,
  [Parameter(Mandatory = $true)][AllowEmptyString()][string]$PowerMeterSerialNumber,
  [Parameter(Mandatory = $true)][AllowEmptyString()][string]$PowerMeterHeadSerialNumber
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

function Read-ZipXml($archive, [string]$entryName) {
  $entry = $archive.GetEntry($entryName)
  if (-not $entry) {
    throw "Workbook entry '$entryName' was not found."
  }

  $document = [System.Xml.XmlDocument]::new()
  $document.PreserveWhitespace = $true
  $stream = $entry.Open()
  try {
    $document.Load($stream)
  } finally {
    $stream.Dispose()
  }
  return $document
}

function Set-InlineCellValue(
  [System.Xml.XmlDocument]$document,
  [System.Xml.XmlNamespaceManager]$namespaces,
  [string]$cellReference,
  [string]$value
) {
  $cell = $document.SelectSingleNode(
    "//*[local-name()='sheetData']/*[local-name()='row']/*[local-name()='c' and @r='$cellReference']"
  )
  if (-not $cell) {
    throw "$System test sheet cell '$cellReference' was not found."
  }

  while ($cell.HasChildNodes) {
    [void]$cell.RemoveChild($cell.FirstChild)
  }
  $cell.SetAttribute('t', 'inlineStr')
  $inlineString = $document.CreateElement('is', $namespaces.LookupNamespace('main'))
  $text = $document.CreateElement('t', $namespaces.LookupNamespace('main'))
  $text.InnerText = $value
  [void]$inlineString.AppendChild($text)
  [void]$cell.AppendChild($inlineString)
}

$archive = [System.IO.Compression.ZipFile]::Open(
  $WorkbookPath,
  [System.IO.Compression.ZipArchiveMode]::Update
)
try {
  $workbook = Read-ZipXml $archive 'xl/workbook.xml'
  $workbookNamespaces = [System.Xml.XmlNamespaceManager]::new($workbook.NameTable)
  $workbookNamespaces.AddNamespace(
    'main',
    'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  )
  $workbookNamespaces.AddNamespace(
    'rel',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  )
  $worksheetNames = switch ($System) {
    'inLux' { @('inLux Test Sheet') }
    'Virsa' { @('Virsa Test Sheet') }
    'InVia' { @('InVia Test Sheet', 'Digital Test Sheet', 'Final Test Sheet') }
  }
  $sheet = $null
  foreach ($worksheetName in $worksheetNames) {
    $sheet = $workbook.SelectSingleNode(
      "//main:sheet[@name='$worksheetName']",
      $workbookNamespaces
    )
    if ($sheet) { break }
  }
  if (-not $sheet) {
    throw "A configured worksheet for the $System test sheet was not found."
  }

  $relationshipId = $sheet.GetAttribute(
    'id',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  )
  $relationships = Read-ZipXml $archive 'xl/_rels/workbook.xml.rels'
  $relationship = $relationships.SelectSingleNode(
    "//*[local-name()='Relationship' and @Id='$relationshipId']"
  )
  if (-not $relationship) {
    throw "Worksheet relationship '$relationshipId' was not found."
  }

  $worksheetPath = $relationship.GetAttribute('Target').TrimStart('/')
  if (-not $worksheetPath.StartsWith('xl/')) {
    $worksheetPath = "xl/$worksheetPath"
  }
  $worksheet = Read-ZipXml $archive $worksheetPath
  $worksheetNamespaces = [System.Xml.XmlNamespaceManager]::new($worksheet.NameTable)
  $worksheetNamespaces.AddNamespace(
    'main',
    'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  )
  if ($System -eq 'InVia') {
    Set-InlineCellValue $worksheet $worksheetNamespaces 'C3' $JobNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'E3' $CustomerName
    Set-InlineCellValue $worksheet $worksheetNamespaces 'H3' $SerialNumber
  } elseif ($System -eq 'inLux') {
    Set-InlineCellValue $worksheet $worksheetNamespaces 'C2' $CustomerName
    Set-InlineCellValue $worksheet $worksheetNamespaces 'C3' $JobNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'F3' $SerialNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'E10' $PowerMeterSerialNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'G10' $PowerMeterHeadSerialNumber
  } else {
    Set-InlineCellValue $worksheet $worksheetNamespaces 'C2' $JobNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'E2' $CustomerName
    Set-InlineCellValue $worksheet $worksheetNamespaces 'G2' $PartNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'I2' $SerialNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'C5' $PowerMeterSerialNumber
    Set-InlineCellValue $worksheet $worksheetNamespaces 'E5' $PowerMeterHeadSerialNumber
  }

  $entry = $archive.GetEntry($worksheetPath)
  $entry.Delete()
  $updatedEntry = $archive.CreateEntry(
    $worksheetPath,
    [System.IO.Compression.CompressionLevel]::Optimal
  )
  $stream = $updatedEntry.Open()
  try {
    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
    $settings.Indent = $false
    $writer = [System.Xml.XmlWriter]::Create($stream, $settings)
    try {
      $worksheet.Save($writer)
    } finally {
      $writer.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
} finally {
  $archive.Dispose()
}
