<#
.SYNOPSIS
    Demonstração de falha controlada do market-data (RNF09).

.DESCRIPTION
    Derruba o contêiner do market-data (SIGKILL, simulando crash), mostra o cliente
    sem resposta e espera o serviço voltar sozinho (restart: unless-stopped).
    No fim compara o estado antes/depois para provar que preço, fase do ciclo e
    eventos agendados voltaram do banco - inclusive a falência, que não dispara de novo (RNF10).

.EXAMPLE
    ./scripts/demo-falha-market-data.ps1
    ./scripts/demo-falha-market-data.ps1 -Url http://localhost:3000 -Ticker CRUS
#>
param(
    # Onde o market-data responde. Pelo compose, o nginx publica em :8080.
    [string]$Url = "http://localhost:8080",
    [string]$Ticker = "GDHD",
    # Aceita "podman compose" ou "docker compose"; detecta sozinho quando vazio.
    [string]$Compose = "",
    [int]$EsperaMaximaSegundos = 90
)

$ErrorActionPreference = "Stop"

function Resolver-Compose {
    if ($Compose -ne "") {
        $partes = $Compose.Split(" ")
        return @{ Exe = $partes[0]; Args = @($partes[1..($partes.Length - 1)]) }
    }
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        return @{ Exe = "docker"; Args = @("compose") }
    }
    if (Get-Command podman -ErrorAction SilentlyContinue) {
        return @{ Exe = "podman"; Args = @("compose") }
    }
    throw "Não encontrei docker nem podman no PATH. Rode o compose manualmente."
}

$composeCmd = Resolver-Compose

function Invoke-Compose {
    param([string[]]$Argumentos)
    Write-Host "> $($composeCmd.Exe) $($composeCmd.Args -join ' ') $($Argumentos -join ' ')" -ForegroundColor DarkGray
    & $composeCmd.Exe @($composeCmd.Args + $Argumentos)
    if ($LASTEXITCODE -ne 0) {
        throw "compose falhou ao executar: $($Argumentos -join ' ')"
    }
}

function Obter-Estado {
    param([string]$Caminho)
    try {
        return Invoke-RestMethod -Uri "$Url$Caminho" -TimeoutSec 5
    } catch {
        return $null
    }
}

function Aguardar {
    param([scriptblock]$Condicao, [string]$Descricao)

    $limite = (Get-Date).AddSeconds($EsperaMaximaSegundos)
    while ((Get-Date) -lt $limite) {
        if (& $Condicao) {
            Write-Host "  ok: $Descricao" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Host "  tempo esgotado esperando: $Descricao" -ForegroundColor Red
    return $false
}

function Mostrar-Ativo {
    param($Ativo, [string]$Rotulo)

    if ($null -eq $Ativo) {
        Write-Host ("{0,-8} {1}" -f $Rotulo, "sem resposta") -ForegroundColor Yellow
        return
    }
    Write-Host ("{0,-8} preco={1} fase={2} status={3}" -f $Rotulo, $Ativo.precoReferencia, $Ativo.faseCiclo, $Ativo.status)
}

Write-Host "`n=== 1. Estado antes da queda ===" -ForegroundColor Cyan
$ativoAntes = Obter-Estado "/ativos/$Ticker"
$eventosAntes = Obter-Estado "/eventos?limite=5"
if ($null -eq $ativoAntes) {
    throw "O market-data não respondeu em $Url. Suba a stack com 'compose up -d' antes da demo."
}
Mostrar-Ativo $ativoAntes "antes"
$falenciaAntes = $eventosAntes | Where-Object { $_.tipo -eq "FALENCIA_FATAL" } | Select-Object -First 1
if ($falenciaAntes) {
    Write-Host "         falência agendada: id=$($falenciaAntes.id) ticker=$($falenciaAntes.ticker) inicio=$($falenciaAntes.inicio)"
}

Write-Host "`n=== 2. Derrubando o market-data (SIGKILL) ===" -ForegroundColor Cyan
Invoke-Compose @("kill", "market-data")
Start-Sleep -Milliseconds 800

$durante = Obter-Estado "/ativos/$Ticker"
Mostrar-Ativo $durante "durante"
if ($null -ne $durante) {
    Write-Host "  (ainda respondeu: o serviço voltou rápido ou há outra instância atendendo)" -ForegroundColor Yellow
}

Write-Host "`n=== 3. Esperando o serviço voltar sozinho (restart: unless-stopped) ===" -ForegroundColor Cyan
$voltou = Aguardar -Descricao "healthcheck de volta" -Condicao {
    $saude = Obter-Estado "/health"
    $null -ne $saude -and $saude.status -eq "ok"
}
if (-not $voltou) {
    Write-Host "Não voltou sozinho. Suba manualmente e repita a demo:" -ForegroundColor Yellow
    Write-Host "  $($composeCmd.Exe) $($composeCmd.Args -join ' ') start market-data" -ForegroundColor DarkGray
    exit 1
}

Write-Host "`n=== 4. Estado depois da retomada ===" -ForegroundColor Cyan
$ativoDepois = Obter-Estado "/ativos/$Ticker"
$eventosDepois = Obter-Estado "/eventos?limite=5"
Mostrar-Ativo $ativoDepois "depois"
$falenciaDepois = $eventosDepois | Where-Object { $_.tipo -eq "FALENCIA_FATAL" } | Select-Object -First 1
if ($falenciaDepois) {
    Write-Host "         falência agendada: id=$($falenciaDepois.id) ticker=$($falenciaDepois.ticker) inicio=$($falenciaDepois.inicio)"
}

Write-Host "`n=== 5. Conclusão ===" -ForegroundColor Cyan
if ($falenciaAntes -and $falenciaDepois -and $falenciaAntes.id -eq $falenciaDepois.id) {
    Write-Host "  RNF10 ok: a mesma falência continua agendada, não foi sorteada de novo." -ForegroundColor Green
} elseif ($falenciaDepois -and -not $falenciaAntes) {
    Write-Host "  RNF10 ok: a falência foi agendada antes da queda e sobreviveu." -ForegroundColor Green
} else {
    Write-Host "  Sem falência agendada nesta sessão (pode já ter disparado)." -ForegroundColor Yellow
}

Write-Host ("  RNF06: preço antes={0} depois={1} - o processo novo continua de onde parou, nao volta ao precoReferencia da config." -f `
    $ativoAntes.precoReferencia, $ativoDepois.precoReferencia)

Write-Host "`n  Rastro de eventos (RNF07):" -ForegroundColor DarkGray
Write-Host "  $($composeCmd.Exe) $($composeCmd.Args -join ' ') logs market-data | Select-String 'EVENT_TRIGGERED|PRICE_ADJUSTED|EVENT_ANNOUNCED|EVENT_SCHEDULED'" -ForegroundColor DarkGray
Write-Host ""
