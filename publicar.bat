@echo off
chcp 65001 >nul
title Publicar Turismo Digital 360 na Vercel
cd /d "%~dp0"
echo.
echo  ==============================================
echo   Turismo Digital 360 - publicar na Vercel
echo  ==============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  O Node.js nao esta instalado. A instalar agora com o winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;C:\Program Files\nodejs"
)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Nao foi possivel instalar o Node.js automaticamente.
  echo  Instale-o em https://nodejs.org e volte a abrir este ficheiro.
  pause
  exit /b 1
)
echo  [1/2] A verificar a sessao na Vercel...
call npx --yes vercel@latest whoami >nul 2>nul
if errorlevel 1 (
  echo  Vai abrir-se o navegador para entrar na Vercel. Confirme o acesso e volte a esta janela.
  call npx --yes vercel@latest login
)
echo.
echo  [2/2] A publicar o site (demora 1 a 2 minutos)...
call npx --yes vercel@latest deploy --prod --yes > "%~dp0publicacao.log" 2>&1
type "%~dp0publicacao.log"
echo.
findstr /c:"Production:" /c:"Aliased" "%~dp0publicacao.log" >nul && (
  echo  PRONTO! O site esta em https://turismo-digital-360.vercel.app
) || (
  echo  Algo correu mal. O registo ficou em publicacao.log - avise o Claude.
)
echo.
pause
