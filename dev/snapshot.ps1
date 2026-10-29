# Preuzima trenutne RSS feedove iz pipeline/sources.json u dev/feeds, za lokalno testiranje obrade.
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Join-Path $PSScriptRoot '..'
$out = Join-Path $PSScriptRoot 'feeds'
New-Item -ItemType Directory -Force $out | Out-Null
$json = [IO.File]::ReadAllText((Join-Path $root 'pipeline\sources.json'), [Text.Encoding]::UTF8)
foreach ($s in ($json | ConvertFrom-Json)) {
  for ($i = 0; $i -lt $s.urls.Count; $i++) {
    $u = $s.urls[$i]
    try {
      $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 20 -UserAgent 'Mozilla/5.0 (compatible; TeletekstVijesti/1.0)'
      [IO.File]::WriteAllBytes((Join-Path $out "$($s.id)-$i.xml"), $r.RawContentStream.ToArray())
      "OK    $($s.id)  $u"
    } catch { "GREŠKA $($s.id)  $u  $($_.Exception.Message)" }
  }
}

# Nogometne lige (isti popis kao LEAGUES u pipeline/football.js)
$leagues = @{ hnl = 'croatia/1st-league'; prvanl = 'croatia/2nd-league'; epl = 'england/premier-league'; laliga = 'spain/laliga';
              bundes = 'germany/bundesliga'; seriea = 'italy/serie-a'; ligue1 = 'france/ligue-1' }
foreach ($k in $leagues.Keys) {
  $u = "https://prod-public-api.livescore.com/v1/api/app/stage/soccer/$($leagues[$k])/0?MD=1"
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 20 -UserAgent 'Mozilla/5.0 (compatible; TeletekstVijesti/1.0)'
    [IO.File]::WriteAllBytes((Join-Path $out "football-$k.json"), $r.RawContentStream.ToArray())
    "OK    nogomet $k"
  } catch { "GREŠKA nogomet $k  $($_.Exception.Message)" }
}
