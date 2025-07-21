# =================================================================
# PROTOCOLO DE CONFORMIDADE DE AMBIENTE - CHANCELLOR
# Define o padrão UTF-8 para toda a sessão do PowerShell.
# Execute este bloco no início do seu perfil.
# =================================================================
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8


# =================================================================
# ARQUITETURA DE AUTOMAÇÃO GIT (v3.1 - Invocação Corrigida)
# =================================================================

# Função auxiliar privada para garantir a execução correta de comandos nativos.
function Invoke-GitCommand {
    param(
        [string]$Arguments
    )
    $stderr = (Invoke-Expression "git $Arguments" 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "O comando 'git $Arguments' falhou. Erro reportado pelo Git: $stderr"
    }
    return $stderr
}

function Submit-GitCommit {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [string]$Message,
        [ValidateSet('feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert')]
        [string]$Type,
        [switch]$NoPush
    )

    begin {
        if (-not (Test-Path ".git" -PathType Container)) {
            throw "ERRO: O diretório atual não é um repositório Git. Operação cancelada."
        }
        $global:conventionalCommits = @{
            '1' = @{ Type = 'feat';     Description = 'Features: Adicionar uma nova funcionalidade.' }
            '2' = @{ Type = 'fix';      Description = 'Bug Fixes: Corrigir um bug.' }
            '3' = @{ Type = 'docs';     Description = 'Documentation: Alterações na documentação.' }
            '4' = @{ Type = 'style';    Description = 'Styles: Formatação, etc; sem alteração de lógica.' }
            '5' = @{ Type = 'refactor'; Description = 'Code Refactoring: Alteração que não corrige bug nem adiciona feature.' }
            '6' = @{ Type = 'perf';     Description = 'Performance: Melhoria de desempenho.' }
            '7' = @{ Type = 'test';     Description = 'Tests: Adicionar ou corrigir testes.' }
            '8' = @{ Type = 'build';    Description = 'Build: Alterações no sistema de build ou dependências.' }
            '9' = @{ Type = 'ci';       Description = 'CI: Alterações em scripts de Continuous Integration.' }
            '10'= @{ Type = 'chore';    Description = 'Chores: Outras alterações que não modificam código fonte ou testes.' }
            '11'= @{ Type = 'revert';   Description = 'Reverts: Reverter um commit anterior.' }
        }
    }

    process {
        try {
            if (-not ($PSBoundParameters.ContainsKey('Type') -and $PSBoundParameters.ContainsKey('Message'))) {
                # MODO INTERATIVO
                Write-Host "Selecione o tipo de commit:" -ForegroundColor Yellow
                $conventionalCommits.GetEnumerator() | Sort-Object { [int]$_.Name } | ForEach-Object {
                    Write-Host ("{0,2}. {1,-10} - {2}" -f $_.Name, $_.Value.Type, $_.Value.Description)
                }
                while($true) {
                    $interactiveChoice = Read-Host "Digite o número da sua escolha"
                    if ([string]::IsNullOrWhiteSpace($interactiveChoice)) { continue }
                    if ($conventionalCommits.ContainsKey($interactiveChoice)) { break }
                    Write-Warning "Opção inválida."
                }
                $interactiveType = $conventionalCommits[$interactiveChoice].Type
                $interactiveMessage = Read-Host "Digite a mensagem do commit"
                if ([string]::IsNullOrWhiteSpace($interactiveMessage)) { throw "ERRO: A mensagem de commit não pode ser vazia." }
                $commitMessage = "$($interactiveType): $($interactiveMessage)"
            }
            else {
                # MODO NÃO-INTERATIVO
                $commitMessage = "$($Type): $($Message)"
            }
            
            $currentBranch = (Invoke-GitCommand "rev-parse --abbrev-ref HEAD").Trim()
            
            if ($PSCmdlet.ShouldProcess("Repositório na branch '$($currentBranch)'", "Executar commit com a mensagem '$commitMessage'")) {
                
                Write-Verbose "Adicionando todos os arquivos..."
                Invoke-GitCommand "add ."

                $status = Invoke-GitCommand "status --porcelain"
                if ([string]::IsNullOrWhiteSpace($status)) {
                    Write-Warning "Nenhuma alteração adicionada ao commit. Operação encerrada."
                    return
                }

                Write-Verbose "Realizando o commit..."
                Invoke-GitCommand "commit -m ""$commitMessage"""
                Write-Host "Commit realizado com sucesso na branch '$($currentBranch)'." -ForegroundColor Green

                if (-not $NoPush) {
                    Write-Verbose "Enviando alterações para 'origin $($currentBranch)'..."
                    Invoke-GitCommand "push origin $currentBranch"
                    Write-Host "Push para a branch '$($currentBranch)' realizado com sucesso!" -ForegroundColor Green
                }
            }
        }
        catch {
            Write-Error "A AUTOMATIZAÇÃO FALHOU. Razão: $($_.Exception.Message)"
        }
    }

    end {
        if (Test-Path "variable:global:conventionalCommits") {
            Remove-Variable -Name "conventionalCommits" -Scope Global
        }
    }
}

# Alias
Set-Alias -Name gc -Value Submit-GitCommit -Option AllScope -Force